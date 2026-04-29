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
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Promotion | null;
  propertyId: string;
  symbol: string;
  saving: boolean;
  setSaving: (v: boolean) => void;
  onSaved: () => void;
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

    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const payload = {
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
    };

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
                  <TooltipContent>
                    Guests can book this promotion during this window
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
                  <TooltipContent>
                    Discount applies to nights within this date range
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
            {editing ? 'Save Changes' : 'Create Promotion'}
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
