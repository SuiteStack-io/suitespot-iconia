import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { NotificationBell } from '@/components/NotificationBell';
import { useAuth } from '@/lib/auth';
import { usePropertySafe } from '@/lib/propertyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CalendarIcon,
  ChevronDown,
  Info,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ---------- types ----------
interface Promotion {
  id: string;
  property_id: string;
  name: string;
  description: string | null;
  booking_window_start: string;
  booking_window_end: string;
  stay_start: string;
  stay_end: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  min_stay: number | null;
  room_types: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type FormState = {
  name: string;
  description: string;
  booking_window_start: Date | undefined;
  booking_window_end: Date | undefined;
  stay_start: Date | undefined;
  stay_end: Date | undefined;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: string;
  min_stay: string;
  room_types: string[];
};

type PromoPayload = {
  property_id: string;
  name: string;
  description: string | null;
  booking_window_start: string;
  booking_window_end: string;
  stay_start: string;
  stay_end: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  min_stay: number | null;
  room_types: string[] | null;
  is_active: boolean;
};

type RateSnapshot = { room_type: string; weekday_rate: number; weekend_rate: number };

type PendingPromo = {
  tempId: string;
  payload: PromoPayload;
  rateSnapshots: RateSnapshot[];
};
function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
function toISO(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}
function fmtRange(startISO: string, endISO: string): string {
  const a = new Date(startISO + 'T00:00:00');
  const b = new Date(endISO + 'T00:00:00');
  return `${format(a, 'MMM d')} - ${format(b, 'MMM d, yyyy')}`;
}
function currencySymbol(code: string | undefined): string {
  switch (code) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'EGP': return 'E£';
    default: return code ? code + ' ' : '$';
  }
}

function statusOf(p: Promotion): 'active' | 'upcoming' | 'expired' {
  const t = todayISO();
  if (p.booking_window_end < t) return 'expired';
  if (p.booking_window_start > t) return 'upcoming';
  return 'active';
}

// ---------- component ----------
export default function Promotions() {
  const { userRole } = useAuth();
  const propertyCtx = usePropertySafe();
  const propertyId = propertyCtx?.activeProperty?.id ?? null;
  const currency = propertyCtx?.activeProperty?.currency ?? 'USD';
  const symbol = currencySymbol(currency);

  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null);
  const [pastOpen, setPastOpen] = useState(false);

  const [pendingPromotions, setPendingPromotions] = useState<PendingPromo[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveStep, setSaveStep] = useState('');
  const [channelMarkups, setChannelMarkups] = useState<
    Array<{ channel_name: string; markup_percentage: number }>
  >([]);

  // Load active channel markups
  useEffect(() => {
    if (!propertyId) return;
    (async () => {
      const { data } = await supabase
        .from('channel_markup_settings')
        .select('channel_name, markup_percentage')
        .eq('property_id', propertyId)
        .eq('is_active', true);
      setChannelMarkups(
        (data ?? []).map((r: any) => ({
          channel_name: r.channel_name,
          markup_percentage: Number(r.markup_percentage),
        })),
      );
    })();
  }, [propertyId]);

  // Warn before unload if pending promotions exist
  useEffect(() => {
    if (pendingPromotions.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [pendingPromotions.length]);

  const addToPending = useCallback(
    (payload: PromoPayload, rateSnapshots: RateSnapshot[]) => {
      setPendingPromotions((prev) => [
        ...prev,
        { tempId: crypto.randomUUID(), payload, rateSnapshots },
      ]);
      toast.success('Added to pending');
    },
    [],
  );

  const removePending = useCallback((tempId: string) => {
    setPendingPromotions((prev) => prev.filter((p) => p.tempId !== tempId));
  }, []);

  async function saveAllPending() {
    if (pendingPromotions.length === 0 || !propertyId) return;
    setSaveStatus('saving');
    setSaveProgress(15);
    setSaveStep('Creating promotions...');
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const rows = pendingPromotions.map((p) => ({
        ...p.payload,
        created_by: userRes.user?.id ?? null,
      }));

      const { error: insertErr } = await supabase
        .from('promotional_periods' as any)
        .insert(rows);
      if (insertErr) throw insertErr;

      setSaveProgress(60);
      setSaveStep('Syncing to Channex...');

      // channex-full-sync only accepts { propertyId } — runs full 500-day sync.
      // calculate-dynamic-price applies promotions on top of dynamic rates per
      // day, so we do NOT compute or push static discounted rates here.
      const { error: syncErr } = await supabase.functions.invoke('channex-full-sync', {
        body: { propertyId },
      });

      setSaveProgress(100);
      if (syncErr) {
        console.warn('channex-full-sync failed', syncErr);
        toast.warning('Promotions saved. Channex sync failed — please retry sync.');
      } else {
        toast.success('Promotions saved and synced to Channex');
      }
      setSaveStatus('success');
      setPendingPromotions([]);
      await fetchPromotions();
      setTimeout(() => {
        setSaveStatus('idle');
        setSaveProgress(0);
        setSaveStep('');
      }, 2000);
    } catch (err: any) {
      console.error('Failed to save pending promotions', err);
      setSaveStatus('error');
      toast.error(err.message || 'Failed to save promotions');
      setTimeout(() => {
        setSaveStatus('idle');
        setSaveProgress(0);
        setSaveStep('');
      }, 3000);
    }
  }


  const fetchPromotions = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('promotional_periods' as any)
      .select('*')
      .eq('property_id', propertyId)
      .order('booking_window_start', { ascending: true });
    if (error) {
      toast.error('Failed to load promotions: ' + error.message);
      setPromotions([]);
    } else {
      setPromotions((data ?? []) as unknown as Promotion[]);
    }
    setLoading(false);
  }, [propertyId]);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  const today = todayISO();
  const activeAndUpcoming = useMemo(
    () => promotions.filter((p) => p.booking_window_end >= today),
    [promotions, today],
  );
  const past = useMemo(
    () => promotions.filter((p) => p.booking_window_end < today),
    [promotions, today],
  );

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(p: Promotion) {
    setEditing(p);
    setDialogOpen(true);
  }

  async function toggleActive(p: Promotion, next: boolean) {
    const { error } = await supabase
      .from('promotional_periods' as any)
      .update({ is_active: next })
      .eq('id', p.id);
    if (error) {
      toast.error('Failed to update: ' + error.message);
      return;
    }
    setPromotions((rows) =>
      rows.map((r) => (r.id === p.id ? { ...r, is_active: next } : r)),
    );
    toast.success(next ? 'Promotion enabled' : 'Promotion disabled');
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from('promotional_periods' as any)
      .delete()
      .eq('id', deleteTarget.id);
    if (error) {
      toast.error('Failed to delete: ' + error.message);
      return;
    }
    setPromotions((rows) => rows.filter((r) => r.id !== deleteTarget.id));
    toast.success('Promotion deleted');
    setDeleteTarget(null);
  }

  if (!propertyId) {
    return (
      <div className="flex min-h-screen">
        <SlideMenu userRole={userRole} />
        <div className="flex-1 p-6">
          <p className="text-muted-foreground">Select a property to manage promotions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <SlideMenu userRole={userRole} />
      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="flex items-center justify-between mb-2">
          <AdminBreadcrumb section="PMS" currentPage="Promotions" />
          <NotificationBell />
        </div>

        {/* Section A: OTA Limitation Notice */}
        <Card className="mb-4 bg-muted/40 border-muted">
          <CardContent className="pt-4 pb-4 flex gap-3 items-start">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Promotions created here apply discounts to your dynamic pricing rates and are
              pushed to all connected OTAs. Note: To get OTA-specific promotional badges
              (such as Booking.com "Getaway Deal" or "Genius Discount"), you must set up the
              promotion directly in the OTA's extranet. This feature controls the underlying
              rate that guests see — not the promotional badge.
            </p>
          </CardContent>
        </Card>

        {/* Section B + C: Active & Upcoming Promotions */}
        <Card className="mb-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Active & Upcoming Promotions</CardTitle>
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Promotion
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : activeAndUpcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No active or upcoming promotions. Click "Create Promotion" to add one.
              </p>
            ) : (
              <div className="space-y-3">
                {activeAndUpcoming.map((p) => (
                  <PromotionRow
                    key={p.id}
                    promotion={p}
                    symbol={symbol}
                    onEdit={() => openEdit(p)}
                    onToggle={(v) => toggleActive(p, v)}
                    onDelete={() => setDeleteTarget(p)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Promotions (queue) */}
        {pendingPromotions.length > 0 && (
          <PendingPromotionsCard
            pending={pendingPromotions}
            symbol={symbol}
            channelMarkups={channelMarkups}
            saveStatus={saveStatus}
            saveProgress={saveProgress}
            saveStep={saveStep}
            onRemove={removePending}
            onSave={saveAllPending}
          />
        )}

        {/* Section D: Past Promotions (collapsible) */}
        <Card>
          <Collapsible open={pastOpen} onOpenChange={setPastOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Past Promotions {past.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({past.length})
                    </span>
                  )}
                </CardTitle>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    pastOpen && 'rotate-180',
                  )}
                />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                {past.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No past promotions.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {past.map((p) => (
                      <PromotionRow
                        key={p.id}
                        promotion={p}
                        symbol={symbol}
                        readOnly
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Create/Edit dialog */}
        <PromotionDialog
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o);
            if (!o) setEditing(null);
          }}
          editing={editing}
          propertyId={propertyId}
          symbol={symbol}
          saving={saving}
          setSaving={setSaving}
          onSaved={() => {
            setDialogOpen(false);
            setEditing(null);
            fetchPromotions();
          }}
          onAddPending={addToPending}
        />

        {/* Delete confirm */}
        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete promotion?</AlertDialogTitle>
              <AlertDialogDescription>
                "{deleteTarget?.name}" will be permanently removed. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ---------- promotion row ----------
function PromotionRow({
  promotion,
  symbol,
  onEdit,
  onToggle,
  onDelete,
  readOnly,
}: {
  promotion: Promotion;
  symbol: string;
  onEdit?: () => void;
  onToggle?: (v: boolean) => void;
  onDelete?: () => void;
  readOnly?: boolean;
}) {
  const status = statusOf(promotion);
  const discountText =
    promotion.discount_type === 'percentage'
      ? `-${Number(promotion.discount_value)}% off`
      : `-${symbol}${Number(promotion.discount_value)} off`;

  const statusBadge =
    status === 'active' ? (
      <Badge className="bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 hover:bg-emerald-500/15">
        Active
      </Badge>
    ) : status === 'upcoming' ? (
      <Badge className="bg-blue-500/15 text-blue-700 border border-blue-500/30 hover:bg-blue-500/15">
        Upcoming
      </Badge>
    ) : (
      <Badge variant="secondary">Expired</Badge>
    );

  return (
    <div className="border rounded-lg p-4 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
      <div className="space-y-1 min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold">{promotion.name}</span>
          {statusBadge}
          <span className="text-sm font-medium text-foreground">{discountText}</span>
          {!promotion.is_active && (
            <Badge variant="outline" className="text-xs">Disabled</Badge>
          )}
        </div>
        {promotion.description && (
          <p className="text-sm text-muted-foreground">{promotion.description}</p>
        )}
        <p className="text-sm text-muted-foreground">
          Bookable: {fmtRange(promotion.booking_window_start, promotion.booking_window_end)}
        </p>
        <p className="text-sm text-muted-foreground">
          For stays: {fmtRange(promotion.stay_start, promotion.stay_end)}
        </p>
        {promotion.min_stay != null && (
          <p className="text-sm text-muted-foreground">
            Min stay: {promotion.min_stay} night{promotion.min_stay === 1 ? '' : 's'}
          </p>
        )}
        {promotion.room_types && promotion.room_types.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Room types: {promotion.room_types.join(', ')}
          </p>
        )}
      </div>
      {!readOnly && (
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 mr-2">
            <Switch
              checked={promotion.is_active}
              onCheckedChange={(v) => onToggle?.(v)}
              aria-label="Toggle promotion"
            />
          </div>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------- create/edit dialog ----------
function PromotionDialog({
  open,
  onOpenChange,
  editing,
  propertyId,
  symbol,
  saving,
  setSaving,
  onSaved,
  onAddPending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Promotion | null;
  propertyId: string;
  symbol: string;
  saving: boolean;
  setSaving: (v: boolean) => void;
  onSaved: () => void;
  onAddPending?: (payload: PromoPayload, rateSnapshots: RateSnapshot[]) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const defaults = useMemo<FormState>(() => ({
    name: '',
    description: '',
    booking_window_start: today,
    booking_window_end: addDays(today, 90),
    stay_start: addDays(today, 30),
    stay_end: addDays(today, 180),
    discount_type: 'percentage',
    discount_value: '',
    min_stay: '',
    room_types: [],
  }), [today]);

  const [form, setForm] = useState<FormState>(defaults);
  const [availableRoomTypes, setAvailableRoomTypes] = useState<string[]>([]);
  const [roomTypesOpen, setRoomTypesOpen] = useState(false);

  // populate when editing
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description ?? '',
        booking_window_start: new Date(editing.booking_window_start + 'T00:00:00'),
        booking_window_end: new Date(editing.booking_window_end + 'T00:00:00'),
        stay_start: new Date(editing.stay_start + 'T00:00:00'),
        stay_end: new Date(editing.stay_end + 'T00:00:00'),
        discount_type: editing.discount_type,
        discount_value: String(editing.discount_value),
        min_stay: editing.min_stay != null ? String(editing.min_stay) : '',
        room_types: editing.room_types ?? [],
      });
    } else {
      setForm(defaults);
    }
  }, [open, editing, defaults]);

  // load distinct room types from units
  useEffect(() => {
    if (!open || !propertyId) return;
    (async () => {
      const { data } = await supabase
        .from('units')
        .select('booking_com_name')
        .eq('property_id', propertyId)
        .not('booking_com_name', 'is', null);
      const set = new Set<string>();
      (data ?? []).forEach((r: any) => {
        if (r.booking_com_name) set.add(r.booking_com_name);
      });
      setAvailableRoomTypes(Array.from(set).sort());
    })();
  }, [open, propertyId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleRoomType(rt: string) {
    setForm((f) => ({
      ...f,
      room_types: f.room_types.includes(rt)
        ? f.room_types.filter((x) => x !== rt)
        : [...f.room_types, rt],
    }));
  }

  async function handleSave() {
    // validation
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!form.booking_window_start || !form.booking_window_end || !form.stay_start || !form.stay_end) {
      toast.error('All date windows are required');
      return;
    }
    if (form.booking_window_end < form.booking_window_start) {
      toast.error('Bookable until must be on or after Bookable from');
      return;
    }
    if (form.stay_end < form.stay_start) {
      toast.error('For stays until must be on or after For stays from');
      return;
    }
    const valNum = Number(form.discount_value);
    if (!form.discount_value || Number.isNaN(valNum) || valNum <= 0) {
      toast.error('Discount value is required');
      return;
    }
    if (form.discount_type === 'percentage' && (valNum < 1 || valNum > 50)) {
      toast.error('Percentage must be between 1 and 50');
      return;
    }
    let minStayValue: number | null = null;
    if (form.min_stay.trim() !== '') {
      const m = Number(form.min_stay);
      if (!Number.isInteger(m) || m < 1) {
        toast.error('Minimum stay must be a positive integer');
        return;
      }
      minStayValue = m;
    }

    const payload: PromoPayload = {
      property_id: propertyId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      booking_window_start: toISO(form.booking_window_start),
      booking_window_end: toISO(form.booking_window_end),
      stay_start: toISO(form.stay_start),
      stay_end: toISO(form.stay_end),
      discount_type: form.discount_type,
      discount_value: valNum,
      min_stay: minStayValue,
      room_types: form.room_types.length > 0 ? form.room_types : null,
      is_active: editing?.is_active ?? true,
    };

    // New promotion + queue mode → fetch rate snapshots, hand off, close.
    if (!editing && onAddPending) {
      setSaving(true);
      try {
        const affected =
          payload.room_types && payload.room_types.length > 0
            ? payload.room_types
            : availableRoomTypes;

        let rateSnapshots: RateSnapshot[] = [];
        if (affected.length > 0) {
          const { data: priceRows } = await supabase
            .from('rate_plan_prices')
            .select('room_type, weekday_rate, weekend_rate, rate_plans!inner(property_id)')
            .eq('rate_plans.property_id', propertyId)
            .in('room_type', affected)
            .is('unit_id', null);

          const seen = new Set<string>();
          rateSnapshots = (priceRows ?? [])
            .filter((r: any) => {
              if (!r.room_type || seen.has(r.room_type)) return false;
              seen.add(r.room_type);
              return true;
            })
            .map((r: any) => ({
              room_type: r.room_type,
              weekday_rate: Number(r.weekday_rate) || 0,
              weekend_rate: Number(r.weekend_rate ?? r.weekday_rate) || 0,
            }));
        }

        onAddPending(payload, rateSnapshots);
        onOpenChange(false);
      } catch (err: any) {
        toast.error('Failed to prepare preview: ' + (err?.message ?? 'unknown error'));
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    let error;
    if (editing) {
      ({ error } = await supabase
        .from('promotional_periods' as any)
        .update(payload)
        .eq('id', editing.id));
    } else {
      ({ error } = await supabase
        .from('promotional_periods' as any)
        .insert({ ...payload, created_by: userRes.user?.id ?? null }));
    }
    setSaving(false);
    if (error) {
      toast.error('Failed to save: ' + error.message);
      return;
    }
    toast.success(editing ? 'Promotion updated' : 'Promotion created');
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Promotion' : 'Create Promotion'}</DialogTitle>
          <DialogDescription>
            Schedule a date-range discount on top of dynamic pricing.
          </DialogDescription>
        </DialogHeader>

        <TooltipProvider>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="promo-name">Promotion Name *</Label>
              <Input
                id="promo-name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Summer Getaway 2026"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="promo-desc">Description</Label>
              <Textarea
                id="promo-desc"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Internal note for the operator"
                rows={2}
              />
            </div>

            {/* Booking window */}
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label>Booking Window *</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    When guests can book this promotion. Discounts only apply to reservations made within this window. Example: Set 'Apr 30 — May 31' to run a one-month promotional campaign.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <DatePickerField
                  label="Bookable from"
                  value={form.booking_window_start}
                  onChange={(d) => update('booking_window_start', d)}
                />
                <DatePickerField
                  label="Bookable until"
                  value={form.booking_window_end}
                  onChange={(d) => update('booking_window_end', d)}
                />
              </div>
            </div>

            {/* Stay window */}
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label>Stay Window *</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Which nights are eligible for the discount. Only stays falling within this date range will receive the promotional rate. Example: Set 'Jul 1 — Aug 31' to discount summer stays.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <DatePickerField
                  label="For stays from"
                  value={form.stay_start}
                  onChange={(d) => update('stay_start', d)}
                />
                <DatePickerField
                  label="For stays until"
                  value={form.stay_end}
                  onChange={(d) => update('stay_end', d)}
                />
              </div>
            </div>

            {/* Discount type */}
            <div className="space-y-2">
              <Label>Discount Type *</Label>
              <RadioGroup
                value={form.discount_type}
                onValueChange={(v) => update('discount_type', v as 'percentage' | 'fixed_amount')}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="percentage" id="dt-pct" />
                  <Label htmlFor="dt-pct" className="font-normal">Percentage</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="fixed_amount" id="dt-fix" />
                  <Label htmlFor="dt-fix" className="font-normal">Fixed Amount Per Night</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Discount value */}
            <div className="space-y-2">
              <Label htmlFor="promo-val">Discount Value *</Label>
              <div className="flex items-center gap-2">
                {form.discount_type === 'fixed_amount' && (
                  <span className="text-sm text-muted-foreground">{symbol}</span>
                )}
                <Input
                  id="promo-val"
                  type="number"
                  inputMode="decimal"
                  value={form.discount_value}
                  onChange={(e) => update('discount_value', e.target.value)}
                  placeholder={form.discount_type === 'percentage' ? '15' : '30'}
                  className="max-w-[160px]"
                />
                {form.discount_type === 'percentage' && (
                  <span className="text-sm text-muted-foreground">% off</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {form.discount_type === 'percentage'
                  ? 'e.g., 15 = 15% off the calculated rate'
                  : `e.g., 30 = ${symbol}30 off per night`}
              </p>
            </div>

            {/* Min stay */}
            <div className="space-y-2">
              <Label htmlFor="promo-min">Minimum Stay</Label>
              <Input
                id="promo-min"
                type="number"
                inputMode="numeric"
                value={form.min_stay}
                onChange={(e) => update('min_stay', e.target.value)}
                placeholder=""
                className="max-w-[160px]"
              />
              <p className="text-xs text-muted-foreground">Leave blank for no minimum</p>
            </div>

            {/* Room types */}
            <div className="space-y-2">
              <Label>Room Types</Label>
              <Popover open={roomTypesOpen} onOpenChange={setRoomTypesOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    <span className="truncate">
                      {form.room_types.length === 0
                        ? 'All room types'
                        : form.room_types.join(', ')}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
                  {availableRoomTypes.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2">
                      No room types found for this property.
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-60 overflow-auto">
                      {availableRoomTypes.map((rt) => (
                        <label
                          key={rt}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                        >
                          <Checkbox
                            checked={form.room_types.includes(rt)}
                            onCheckedChange={() => toggleRoomType(rt)}
                          />
                          <span className="text-sm">{rt}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Leave empty to apply to all room types.
              </p>
            </div>
          </div>
        </TooltipProvider>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editing ? 'Save Changes' : (onAddPending ? 'Add to Pending' : 'Create Promotion')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- date picker field ----------
function DatePickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !value && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, 'PPP') : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            initialFocus
            className={cn('p-3 pointer-events-auto')}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ---------- pending promotions card ----------
function PendingPromotionsCard({
  pending,
  symbol,
  channelMarkups,
  saveStatus,
  saveProgress,
  saveStep,
  onRemove,
  onSave,
}: {
  pending: PendingPromo[];
  symbol: string;
  channelMarkups: Array<{ channel_name: string; markup_percentage: number }>;
  saveStatus: 'idle' | 'saving' | 'success' | 'error';
  saveProgress: number;
  saveStep: string;
  onRemove: (tempId: string) => void;
  onSave: () => void;
}) {
  const fmt = (v: number) => `${symbol}${Math.round(v)}`;

  return (
    <Card className="mb-4 border-blue-500/40 bg-blue-500/5">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Pending Promotions</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {pending.length} promotion{pending.length === 1 ? '' : 's'} ready to save
          </p>
        </div>
        <Button onClick={onSave} disabled={saveStatus === 'saving'} size="sm">
          {saveStatus === 'saving' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {saveStatus !== 'idle' && (
          <div className="space-y-1">
            <Progress value={saveProgress} />
            {saveStep && (
              <p className="text-xs text-muted-foreground">{saveStep}</p>
            )}
          </div>
        )}

        {pending.map((p) => {
          const payload = p.payload;
          const after = (base: number) =>
            payload.discount_type === 'percentage'
              ? base * (1 - payload.discount_value / 100)
              : Math.max(0, base - payload.discount_value);
          const channelOf = (v: number, pct: number) => v * (1 + pct / 100);
          const discountText =
            payload.discount_type === 'percentage'
              ? `-${payload.discount_value}% off`
              : `-${symbol}${payload.discount_value} off`;

          return (
            <div key={p.tempId} className="border rounded-lg p-4 bg-background space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{payload.name}</span>
                    <Badge className="bg-amber-500/15 text-amber-700 border border-amber-500/30 hover:bg-amber-500/15">
                      {discountText}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Bookable: {fmtRange(payload.booking_window_start, payload.booking_window_end)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    For stays: {fmtRange(payload.stay_start, payload.stay_end)}
                  </p>
                  {payload.min_stay != null && (
                    <p className="text-sm text-muted-foreground">
                      Min stay: {payload.min_stay} night{payload.min_stay === 1 ? '' : 's'}
                    </p>
                  )}
                  {payload.room_types && payload.room_types.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Room types: {payload.room_types.join(', ')}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(p.tempId)}
                  disabled={saveStatus === 'saving'}
                  aria-label="Remove from pending"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {p.rateSnapshots.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No base rates configured for affected room types — preview unavailable.
                </p>
              ) : (
                <div className="rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Room Type</TableHead>
                        <TableHead>Day</TableHead>
                        <TableHead>PMS Before → After</TableHead>
                        {channelMarkups.map((c) => (
                          <TableHead key={c.channel_name}>
                            {c.channel_name} Before → After
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {p.rateSnapshots.flatMap((snap) => {
                        const rows: Array<{ day: string; base: number }> = [
                          { day: 'Wkd', base: snap.weekday_rate },
                          { day: 'Wkn', base: snap.weekend_rate },
                        ];
                        return rows.map((r) => {
                          const aft = after(r.base);
                          return (
                            <TableRow key={`${snap.room_type}-${r.day}`}>
                              <TableCell className="font-medium">{snap.room_type}</TableCell>
                              <TableCell>{r.day}</TableCell>
                              <TableCell>
                                {fmt(r.base)} → <span className="text-emerald-600">{fmt(aft)}</span>
                              </TableCell>
                              {channelMarkups.map((c) => {
                                const cb = channelOf(r.base, c.markup_percentage);
                                const ca = channelOf(aft, c.markup_percentage);
                                return (
                                  <TableCell key={c.channel_name}>
                                    {fmt(cb)} → <span className="text-emerald-600">{fmt(ca)}</span>
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        });
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Preview based on current base rates. Actual rates will reflect dynamic pricing
                adjustments at the time of stay.
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
