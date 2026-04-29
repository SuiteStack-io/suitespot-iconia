import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { useAuth } from '@/lib/auth';
import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, ChevronDown, Info, RotateCcw, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { NotificationBell } from '@/components/NotificationBell';
import { cn } from '@/lib/utils';
import type { Json } from '@/integrations/supabase/types';

// ---------- types ----------
interface PricingRules {
  id: string;
  property_id: string;
  is_enabled: boolean;
  day_of_week_multipliers: Record<string, number>;
  occupancy_thresholds: number[];
  occupancy_adjustments: number[];
  revenue_thresholds: number[];
  revenue_adjustments_phase_a: number[];
  revenue_adjustments_phase_b: number[];
  pace_index_bump_threshold: number;
  monthly_revenue_target: number | null;
  monthly_revenue_stretch: number | null;
  last_minute_strategy: string;
  channex_min_price_synced: boolean;
  channex_max_price_synced: boolean;
  revenue_occupancy_conflict_cap: number;
  revenue_occupancy_conflict_revenue_min: number;
  revenue_occupancy_conflict_occupancy_max: number;
}

interface RoomRateBound {
  id: string;
  room_type: string;
  weekday_rate: number;
  weekend_rate: number;
  min_rate: number | null;
  max_rate: number | null;
}

const DEFAULT_DOW: Record<string, number> = {
  '0': 0.95, '1': 0.95, '2': 0.93, '3': 0.95, '4': 1.0, '5': 1.1, '6': 1.15,
};
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatWithCommas(n: number | null): string {
  if (n === null || n === undefined) return '';
  return n.toLocaleString('en-US');
}

// ---------- component ----------
export default function DynamicPricing() {
  const { userRole } = useAuth();
  const propertyId = usePropertyId();

  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<PricingRules | null>(null);
  const [rateBounds, setRateBounds] = useState<RoomRateBound[]>([]);
  const [boundsErrors, setBoundsErrors] = useState<Record<string, string>>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Channel markups for OTA preview
  const [channelMarkups, setChannelMarkups] = useState<{ id: string; channel_name: string; markup_percentage: number }[]>([]);

  // Pending changes tracking
  const [pendingRulesChanges, setPendingRulesChanges] = useState<Partial<PricingRules>>({});
  const [pendingBoundsChanges, setPendingBoundsChanges] = useState<Record<string, {
    original: { min: number | null; max: number | null };
    pending: { min: number | null; max: number | null };
  }>>({});

  // Per-row input drafts (string to preserve empty)
  const [inputDrafts, setInputDrafts] = useState<Record<string, { min: string; max: string }>>({});

  // Save status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveProgress, setSaveProgress] = useState(0);

  // Last channex sync timestamp
  const [lastChannexSync, setLastChannexSync] = useState<string | null>(null);

  // Revenue input focus state
  const [revenueTargetFocused, setRevenueTargetFocused] = useState(false);
  const [stretchTargetFocused, setStretchTargetFocused] = useState(false);

  // Pace info dialog
  const [paceInfoOpen, setPaceInfoOpen] = useState(false);

  const pendingRulesCount = Object.keys(pendingRulesChanges).length;
  const pendingBoundsCount = Object.keys(pendingBoundsChanges).length;
  const totalPendingChanges = pendingRulesCount + pendingBoundsCount;

  // ---- helpers ----
  const weekendRatio = (b: RoomRateBound) => (b.weekday_rate > 0 ? b.weekend_rate / b.weekday_rate : 1);
  const withMarkup = (value: number | null, pct: number): number | null =>
    value == null ? null : value * (1 + pct / 100);
  const formatUsd = (n: number | null | undefined): string =>
    n == null || !isFinite(n) ? '—' : '$' + Math.round(n).toLocaleString();
  const parseDraft = (s: string): number | null => {
    if (s === '' || s == null) return null;
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  };

  // Load last channex sync from localStorage
  useEffect(() => {
    if (propertyId) {
      const stored = localStorage.getItem(`dynamic_pricing_last_channex_sync_${propertyId}`);
      setLastChannexSync(stored);
    }
  }, [propertyId]);

  // beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (totalPendingChanges > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved pricing changes that will be lost.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [totalPendingChanges]);

  // ---- load pricing_rules ----
  const loadRules = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('pricing_rules')
      .select('*')
      .eq('property_id', propertyId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load pricing rules', error);
      toast.error('Failed to load pricing settings');
      setLoading(false);
      return;
    }

    if (data) {
      setRules(mapRulesRow(data));
    } else {
      const { data: created, error: createErr } = await supabase
        .from('pricing_rules')
        .insert({ property_id: propertyId })
        .select('*')
        .single();
      if (createErr) {
        console.error('Failed to create pricing rules', createErr);
        toast.error('Failed to initialise pricing settings');
      } else if (created) {
        setRules(mapRulesRow(created));
      }
    }
    setLoading(false);
  }, [propertyId]);

  // ---- load rate bounds ----
  const loadBounds = useCallback(async () => {
    if (!propertyId) return;
    const { data, error } = await supabase
      .from('rate_plan_prices')
      .select('id, room_type, weekday_rate, weekend_rate, min_rate, max_rate, rate_plan_id, rate_plans!inner(property_id)')
      .eq('rate_plans.property_id', propertyId);

    if (error) {
      console.error('Failed to load rate bounds', error);
      return;
    }

    const byType: Record<string, RoomRateBound> = {};
    for (const row of (data ?? []) as any[]) {
      if (!byType[row.room_type]) {
        byType[row.room_type] = {
          id: row.id,
          room_type: row.room_type,
          weekday_rate: row.weekday_rate,
          weekend_rate: row.weekend_rate,
          min_rate: row.min_rate,
          max_rate: row.max_rate,
        };
      }
    }
    const sorted = Object.values(byType).sort((a, b) => a.room_type.localeCompare(b.room_type));
    setRateBounds(sorted);
    const drafts: Record<string, { min: string; max: string }> = {};
    for (const b of sorted) {
      drafts[b.room_type] = {
        min: b.min_rate == null ? '' : String(b.min_rate),
        max: b.max_rate == null ? '' : String(b.max_rate),
      };
    }
    setInputDrafts(drafts);
  }, [propertyId]);

  // ---- load active channel markups (copied from src/pages/pms/Prices.tsx:187) ----
  const loadMarkups = useCallback(async () => {
    if (!propertyId) return;
    const { data, error } = await withPropertyFilter(
      supabase.from('channel_markup_settings').select('id, channel_name, markup_percentage').eq('is_active', true),
      propertyId
    );
    if (error) {
      console.error('Failed to load channel markups', error);
      return;
    }
    setChannelMarkups((data ?? []) as { id: string; channel_name: string; markup_percentage: number }[]);
  }, [propertyId]);

  useEffect(() => {
    loadRules();
    loadBounds();
    loadMarkups();
  }, [loadRules, loadBounds, loadMarkups]);

  // ---- local change handlers (no DB writes) ----
  function updateRules(patch: Partial<PricingRules>) {
    if (!rules) return;
    setRules({ ...rules, ...patch });
    setPendingRulesChanges((prev) => ({ ...prev, ...patch }));
  }

  function setDraft(roomType: string, field: 'min' | 'max', value: string) {
    setInputDrafts((prev) => ({
      ...prev,
      [roomType]: { ...(prev[roomType] ?? { min: '', max: '' }), [field]: value },
    }));
  }

  function applyBound(roomType: string) {
    const bound = rateBounds.find((b) => b.room_type === roomType);
    if (!bound) return;
    const draft = inputDrafts[roomType] ?? { min: '', max: '' };
    const pendingMin = parseDraft(draft.min);
    const pendingMax = parseDraft(draft.max);
    if (pendingMin !== null && pendingMax !== null && pendingMin >= pendingMax) {
      setBoundsErrors((prev) => ({ ...prev, [roomType]: 'Min must be less than Max' }));
      return;
    }
    setBoundsErrors((prev) => {
      const c = { ...prev };
      delete c[roomType];
      return c;
    });
    setPendingBoundsChanges((prev) => ({
      ...prev,
      [roomType]: {
        original: prev[roomType]?.original ?? { min: bound.min_rate, max: bound.max_rate },
        pending: { min: pendingMin, max: pendingMax },
      },
    }));
  }

  function removePendingBound(roomType: string) {
    const bound = rateBounds.find((b) => b.room_type === roomType);
    setPendingBoundsChanges((prev) => {
      const c = { ...prev };
      delete c[roomType];
      return c;
    });
    if (bound) {
      setInputDrafts((prev) => ({
        ...prev,
        [roomType]: {
          min: bound.min_rate == null ? '' : String(bound.min_rate),
          max: bound.max_rate == null ? '' : String(bound.max_rate),
        },
      }));
    }
    setBoundsErrors((prev) => {
      const c = { ...prev };
      delete c[roomType];
      return c;
    });
  }

  // ---- save all pending changes (with auto Channex sync for rate bounds) ----
  async function saveAllChanges() {
    if (!rules || totalPendingChanges === 0) return;
    setSaveStatus('saving');
    setSaveProgress(10);

    const hasBoundsChanges = Object.keys(pendingBoundsChanges).length > 0;

    try {
      // Validate bounds
      for (const [roomType, bounds] of Object.entries(pendingBoundsChanges)) {
        const minVal = bounds.pending.min;
        const maxVal = bounds.pending.max;
        if (minVal !== null && maxVal !== null && minVal >= maxVal) {
          setBoundsErrors((prev) => ({ ...prev, [roomType]: 'Min must be less than Max' }));
          setSaveStatus('error');
          setSaveProgress(0);
          toast.error(`Invalid bounds for ${roomType}: Min must be less than Max`);
          return;
        }
        setBoundsErrors((prev) => {
          const copy = { ...prev };
          delete copy[roomType];
          return copy;
        });
      }

      setSaveProgress(25);

      // 1. Save pricing_rules changes
      if (pendingRulesCount > 0) {
        const { error } = await supabase
          .from('pricing_rules')
          .update(toDbRow(pendingRulesChanges))
          .eq('id', rules.id);
        if (error) throw error;
      }

      setSaveProgress(45);

      // 2. Save rate bounds changes
      const boundEntries = Object.entries(pendingBoundsChanges);
      for (let i = 0; i < boundEntries.length; i++) {
        const [roomType, change] = boundEntries[i];
        const bound = rateBounds.find((b) => b.room_type === roomType);
        if (!bound) continue;
        const { error } = await supabase
          .from('rate_plan_prices')
          .update({ min_rate: change.pending.min, max_rate: change.pending.max } as any)
          .eq('id', bound.id);
        if (error) throw error;
        setSaveProgress(45 + Math.round(((i + 1) / boundEntries.length) * 30));
      }

      // Build the updated rateBounds (post-save baseline)
      const updatedBounds: RoomRateBound[] = rateBounds.map((b) => {
        const ch = pendingBoundsChanges[b.room_type];
        return ch ? { ...b, min_rate: ch.pending.min, max_rate: ch.pending.max } : b;
      });

      // 3. If bounds changed, sync property-level floor/ceiling to Channex
      if (hasBoundsChanges && propertyId) {
        setSaveProgress(80);
        const allMinRates = updatedBounds.filter((b) => b.min_rate !== null).map((b) => b.min_rate!);
        const allMaxRates = updatedBounds.filter((b) => b.max_rate !== null).map((b) => b.max_rate!);
        const floorValue = allMinRates.length > 0 ? Math.min(...allMinRates) : null;
        const ceilingValue = allMaxRates.length > 0 ? Math.max(...allMaxRates) : null;

        if (floorValue !== null || ceilingValue !== null) {
          const { data, error } = await supabase.functions.invoke('channex-update-property-settings', {
            body: { property_id: propertyId, min_price: floorValue, max_price: ceilingValue },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);

          await supabase
            .from('pricing_rules')
            .update({
              channex_min_price_synced: floorValue !== null,
              channex_max_price_synced: ceilingValue !== null,
            })
            .eq('property_id', propertyId);

          setRules((prev) =>
            prev
              ? {
                  ...prev,
                  channex_min_price_synced: floorValue !== null,
                  channex_max_price_synced: ceilingValue !== null,
                }
              : prev
          );

          const timestamp = new Date().toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
          });
          localStorage.setItem(`dynamic_pricing_last_channex_sync_${propertyId}`, timestamp);
          setLastChannexSync(timestamp);
        }
      }

      // Commit new baseline + clear pendings
      setRateBounds(updatedBounds);
      const newDrafts: Record<string, { min: string; max: string }> = {};
      for (const b of updatedBounds) {
        newDrafts[b.room_type] = {
          min: b.min_rate == null ? '' : String(b.min_rate),
          max: b.max_rate == null ? '' : String(b.max_rate),
        };
      }
      setInputDrafts(newDrafts);

      setSaveProgress(100);
      setSaveStatus('success');
      setPendingRulesChanges({});
      setPendingBoundsChanges({});
      toast.success(hasBoundsChanges ? 'Pricing settings saved and synced to Channex' : 'Pricing settings saved');

      setTimeout(() => {
        setSaveStatus('idle');
        setSaveProgress(0);
      }, 2000);
    } catch (err: any) {
      console.error('Save failed', err);
      setSaveStatus('error');
      toast.error(err.message || 'Failed to save pricing settings');
      // Keep pendingBoundsChanges so the operator can retry
      setTimeout(() => {
        setSaveStatus('idle');
        setSaveProgress(0);
      }, 3000);
    }
  }

  // ---- render ----
  if (!propertyId) {
    return (
      <div className="flex min-h-screen">
        <SlideMenu userRole={userRole} />
        <div className="flex-1 p-6">
          <p className="text-muted-foreground">Select a property to configure dynamic pricing.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <SlideMenu userRole={userRole} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!rules) return null;

  const dow = rules.day_of_week_multipliers;

  return (
    <div className="flex min-h-screen bg-background">
      <SlideMenu userRole={userRole} />
      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="flex items-center justify-between mb-2">
          <AdminBreadcrumb section="Operations" currentPage="Dynamic Pricing" />
          <NotificationBell />
        </div>

        {/* Sticky save bar */}
        {totalPendingChanges > 0 && (
          <div className="sticky top-0 z-20 mb-4">
            <div className="flex items-center justify-between bg-card border rounded-lg px-4 py-3 shadow-sm">
              <span className="text-sm font-medium">
                {totalPendingChanges} unsaved change{totalPendingChanges !== 1 ? 's' : ''}
              </span>
              <Button onClick={saveAllChanges} disabled={saveStatus === 'saving'} size="sm">
                {saveStatus === 'saving' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes ({totalPendingChanges})
              </Button>
            </div>
            {saveStatus !== 'idle' && (
              <div className="mt-1 space-y-1">
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      saveStatus === 'error' ? 'bg-destructive' :
                      saveStatus === 'success' ? 'bg-green-500' : 'bg-primary'
                    )}
                    style={{ width: `${saveProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <h1 className="text-2xl font-bold mb-6">Dynamic Pricing</h1>

        <div className="space-y-6 max-w-4xl">
          {/* Section A: Master Toggle */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Enable Dynamic Pricing</CardTitle>
                  <CardDescription>When enabled, rates are automatically adjusted based on occupancy, pace, and revenue targets.</CardDescription>
                </div>
                <Switch
                  checked={rules.is_enabled}
                  onCheckedChange={(checked) => updateRules({ is_enabled: checked })}
                />
              </div>
            </CardHeader>
            {!rules.is_enabled && (
              <CardContent>
                <p className="text-sm text-muted-foreground">Dynamic pricing is disabled. Rates from Rate Plans will be used as-is.</p>
              </CardContent>
            )}
          </Card>

          {rules.is_enabled && (
            <>
              {/* Section B: Rate Guardrails */}
              <Card>
                <CardHeader>
                  <CardTitle>Rate Guardrails</CardTitle>
                  <CardDescription>Set minimum and maximum rates per room type. These protect against the algorithm pricing too low or too high.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Room Type</TableHead>
                          <TableHead className="text-right">Weekday Rate</TableHead>
                          <TableHead className="text-right">Weekend Rate</TableHead>
                          <TableHead className="text-right">Min Rate</TableHead>
                          <TableHead className="text-right">Max Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rateBounds.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">No room types found. Create rate plans first.</TableCell>
                          </TableRow>
                        )}
                        {rateBounds.map((bound) => (
                          <TableRow key={bound.room_type}>
                            <TableCell className="font-medium">{bound.room_type}</TableCell>
                            <TableCell className="text-right">{bound.weekday_rate.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{bound.weekend_rate.toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="No minimum"
                                className="w-28 ml-auto text-right"
                                value={bound.min_rate ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                  updateBound(bound.room_type, 'min_rate', val);
                                }}
                              />
                              {boundsErrors[bound.room_type] && (
                                <p className="text-xs text-destructive mt-1">{boundsErrors[bound.room_type]}</p>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="No maximum"
                                className="w-28 ml-auto text-right"
                                value={bound.max_rate ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                  updateBound(bound.room_type, 'max_rate', val);
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-muted rounded-md">
                    <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">These bounds are also synced to your channel manager as a safety net. Channex will reject any rate outside these bounds even if the PMS has a bug.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Section C: Channex Sync */}
              <Card>
                <CardHeader>
                  <CardTitle>Channex Rate Bounds Sync</CardTitle>
                  <CardDescription>Push your property-level min/max rate bounds to Channex for safety enforcement.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4">
                    <Button onClick={syncToChannex} disabled={channexSyncStatus === 'syncing'}>
                      {channexSyncStatus === 'syncing' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      {channexSyncStatus === 'syncing' ? 'Syncing...' : 'Sync Rate Bounds to Channex'}
                    </Button>
                    <div className="text-xs text-muted-foreground space-x-3">
                      <span>Min synced: {rules.channex_min_price_synced ? '✓' : '—'}</span>
                      <span>Max synced: {rules.channex_max_price_synced ? '✓' : '—'}</span>
                    </div>
                  </div>
                  {channexSyncStatus !== 'idle' && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{channexSyncStep}</span>
                        <span>{channexSyncProgress}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            channexSyncStatus === 'error' ? 'bg-destructive' :
                            channexSyncStatus === 'success' ? 'bg-green-500' : 'bg-primary'
                          )}
                          style={{ width: `${channexSyncProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {lastChannexSync && (
                    <p className="text-xs text-muted-foreground">Last synced: {lastChannexSync}</p>
                  )}
                </CardContent>
              </Card>

              {/* Section D: Day-of-Week Multipliers */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Day-of-Week Multipliers</CardTitle>
                      <CardDescription>Adjust rates by day of week. 1.00 = no change, 1.10 = +10%, 0.90 = −10%.</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateRules({ day_of_week_multipliers: DEFAULT_DOW })}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" /> Reset
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-2">
                    {DAY_LABELS.map((label, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <Label className="text-xs font-medium">{label}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className="w-full text-center text-sm"
                          value={dow[String(i)] ?? 1}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 1;
                            updateRules({ day_of_week_multipliers: { ...dow, [String(i)]: val } });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Section E: Revenue Targets */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Revenue Targets</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Monthly Revenue Target</Label>
                    <Input
                      type={revenueTargetFocused ? 'number' : 'text'}
                      step="100"
                      placeholder="e.g. 50,000"
                      value={revenueTargetFocused ? (rules.monthly_revenue_target ?? '') : formatWithCommas(rules.monthly_revenue_target)}
                      onFocus={() => setRevenueTargetFocused(true)}
                      onBlur={() => setRevenueTargetFocused(false)}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : parseFloat(e.target.value);
                        updateRules({ monthly_revenue_target: val });
                      }}
                    />
                    <p className="text-xs text-muted-foreground">Target revenue to cover costs and margin</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Stretch Target</Label>
                    <Input
                      type={stretchTargetFocused ? 'number' : 'text'}
                      step="100"
                      placeholder="e.g. 65,000"
                      value={stretchTargetFocused ? (rules.monthly_revenue_stretch ?? '') : formatWithCommas(rules.monthly_revenue_stretch)}
                      onFocus={() => setStretchTargetFocused(true)}
                      onBlur={() => setStretchTargetFocused(false)}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : parseFloat(e.target.value);
                        updateRules({ monthly_revenue_stretch: val });
                      }}
                    />
                    <p className="text-xs text-muted-foreground">Aspirational target (typically 120-130% of base)</p>
                  </div>
                </CardContent>
              </Card>

              {/* Section F: Last-Minute Strategy */}
              <Card>
                <CardHeader>
                  <CardTitle>Last-Minute Strategy</CardTitle>
                  <CardDescription>How to price bookings made within 0–2 days of check-in.</CardDescription>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={rules.last_minute_strategy}
                    onValueChange={(val) => updateRules({ last_minute_strategy: val })}
                  >
                    <div className="flex items-start space-x-2 mb-3">
                      <RadioGroupItem value="discount" id="lm-discount" />
                      <div>
                        <Label htmlFor="lm-discount" className="font-medium">Discount</Label>
                        <p className="text-xs text-muted-foreground">Apply −5% for bookings within 0–2 days of check-in (vacation/leisure markets)</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <RadioGroupItem value="premium" id="lm-premium" />
                      <div>
                        <Label htmlFor="lm-premium" className="font-medium">Premium</Label>
                        <p className="text-xs text-muted-foreground">Apply +15% for bookings within 0–2 days of check-in (urban/business markets)</p>
                      </div>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>

              {/* Section G: Advanced */}
              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Advanced — Occupancy & Revenue Tiers</CardTitle>
                          <CardDescription>Fine-tune tier thresholds. Most operators should leave these at defaults.</CardDescription>
                        </div>
                        <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-6">
                      {/* Occupancy tiers */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Occupancy Tiers</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>From %</TableHead>
                              <TableHead>To %</TableHead>
                              <TableHead>Rate Adjustment %</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rules.occupancy_adjustments.map((adj, idx) => {
                              const from = idx === 0 ? 0 : rules.occupancy_thresholds[idx - 1] + 1;
                              const to = idx < rules.occupancy_thresholds.length ? rules.occupancy_thresholds[idx] : 100;
                              return (
                                <TableRow key={idx}>
                                  <TableCell>{from}%</TableCell>
                                  <TableCell>{to}%</TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      className="w-20"
                                      value={adj}
                                      onChange={(e) => {
                                        const newAdj = [...rules.occupancy_adjustments];
                                        newAdj[idx] = parseFloat(e.target.value) || 0;
                                        updateRules({ occupancy_adjustments: newAdj });
                                      }}
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Pace Index */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label>Pace Index Bump Threshold</Label>
                          <Info
                            className="h-4 w-4 text-muted-foreground cursor-pointer"
                            onClick={() => setPaceInfoOpen(true)}
                          />
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          className="w-32"
                          value={rules.pace_index_bump_threshold}
                          onChange={(e) => updateRules({ pace_index_bump_threshold: parseFloat(e.target.value) || 1.3 })}
                        />
                        <p className="text-xs text-muted-foreground">Bump occupancy tier by +1 when pace index exceeds this value (default 1.30)</p>
                      </div>

                      {/* Revenue tiers */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Revenue Adjustment Tiers</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Threshold %</TableHead>
                              <TableHead>Phase A Adj %</TableHead>
                              <TableHead>Phase B Adj %</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rules.revenue_thresholds.map((thresh, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{thresh}%</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    className="w-20"
                                    value={rules.revenue_adjustments_phase_a[idx] ?? 0}
                                    onChange={(e) => {
                                      const newA = [...rules.revenue_adjustments_phase_a];
                                      newA[idx] = parseFloat(e.target.value) || 0;
                                      updateRules({ revenue_adjustments_phase_a: newA });
                                    }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    className="w-20"
                                    value={rules.revenue_adjustments_phase_b[idx] ?? 0}
                                    onChange={(e) => {
                                      const newB = [...rules.revenue_adjustments_phase_b];
                                      newB[idx] = parseFloat(e.target.value) || 0;
                                      updateRules({ revenue_adjustments_phase_b: newB });
                                    }}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </>
          )}
        </div>
      </div>

      {/* Pace Index Info Dialog */}
      <Dialog open={paceInfoOpen} onOpenChange={setPaceInfoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>What is the Pace Index?</DialogTitle>
          </DialogHeader>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>The Pace Index measures how fast your property is filling up compared to how much of the month has passed.</p>
              <p className="font-medium text-foreground">How it works:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>If your property is 60% booked and only 40% of the month has passed, your Pace Index is 1.5 — meaning you're filling 50% faster than expected.</li>
                <li>A Pace Index of 1.0 means you're filling exactly on track.</li>
                <li>Below 1.0 means you're behind pace.</li>
              </ul>
              <p>The Bump Threshold (default 1.30) controls when the algorithm gets more aggressive with pricing. When the Pace Index exceeds this threshold, the algorithm bumps the occupancy adjustment up one tier — for example, from +10% to +18%.</p>
              <p>A lower threshold (e.g., 1.1) makes pricing more aggressive earlier. A higher threshold (e.g., 1.5) waits longer before bumping up. Most properties should keep the default of 1.30.</p>
            </div>
          </DialogDescription>
          <div className="flex justify-end mt-2">
            <Button onClick={() => setPaceInfoOpen(false)}>Got it</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- helpers ----------
function mapRulesRow(row: any): PricingRules {
  return {
    id: row.id,
    property_id: row.property_id,
    is_enabled: row.is_enabled,
    day_of_week_multipliers: (typeof row.day_of_week_multipliers === 'object' ? row.day_of_week_multipliers : DEFAULT_DOW) as Record<string, number>,
    occupancy_thresholds: (Array.isArray(row.occupancy_thresholds) ? row.occupancy_thresholds : [30, 50, 65, 75, 85, 92]) as number[],
    occupancy_adjustments: (Array.isArray(row.occupancy_adjustments) ? row.occupancy_adjustments : [0, 5, 10, 18, 28, 40, 55]) as number[],
    revenue_thresholds: (Array.isArray(row.revenue_thresholds) ? row.revenue_thresholds : [40, 60, 80, 95, 100, 120]) as number[],
    revenue_adjustments_phase_a: (Array.isArray(row.revenue_adjustments_phase_a) ? row.revenue_adjustments_phase_a : [0, 0, 5, 5, 10, 10, 10]) as number[],
    revenue_adjustments_phase_b: (Array.isArray(row.revenue_adjustments_phase_b) ? row.revenue_adjustments_phase_b : [0, 0, 5, 10, 15, 20, 25]) as number[],
    pace_index_bump_threshold: row.pace_index_bump_threshold,
    monthly_revenue_target: row.monthly_revenue_target,
    monthly_revenue_stretch: row.monthly_revenue_stretch,
    last_minute_strategy: row.last_minute_strategy,
    channex_min_price_synced: row.channex_min_price_synced,
    channex_max_price_synced: row.channex_max_price_synced,
    revenue_occupancy_conflict_cap: row.revenue_occupancy_conflict_cap,
    revenue_occupancy_conflict_revenue_min: row.revenue_occupancy_conflict_revenue_min,
    revenue_occupancy_conflict_occupancy_max: row.revenue_occupancy_conflict_occupancy_max,
  };
}

function toDbRow(patch: Partial<PricingRules>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.is_enabled !== undefined) out.is_enabled = patch.is_enabled;
  if (patch.day_of_week_multipliers !== undefined) out.day_of_week_multipliers = patch.day_of_week_multipliers;
  if (patch.occupancy_thresholds !== undefined) out.occupancy_thresholds = patch.occupancy_thresholds;
  if (patch.occupancy_adjustments !== undefined) out.occupancy_adjustments = patch.occupancy_adjustments;
  if (patch.revenue_thresholds !== undefined) out.revenue_thresholds = patch.revenue_thresholds;
  if (patch.revenue_adjustments_phase_a !== undefined) out.revenue_adjustments_phase_a = patch.revenue_adjustments_phase_a;
  if (patch.revenue_adjustments_phase_b !== undefined) out.revenue_adjustments_phase_b = patch.revenue_adjustments_phase_b;
  if (patch.pace_index_bump_threshold !== undefined) out.pace_index_bump_threshold = patch.pace_index_bump_threshold;
  if (patch.monthly_revenue_target !== undefined) out.monthly_revenue_target = patch.monthly_revenue_target;
  if (patch.monthly_revenue_stretch !== undefined) out.monthly_revenue_stretch = patch.monthly_revenue_stretch;
  if (patch.last_minute_strategy !== undefined) out.last_minute_strategy = patch.last_minute_strategy;
  if (patch.channex_min_price_synced !== undefined) out.channex_min_price_synced = patch.channex_min_price_synced;
  if (patch.channex_max_price_synced !== undefined) out.channex_max_price_synced = patch.channex_max_price_synced;
  return out;
}
