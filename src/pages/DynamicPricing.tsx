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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, ChevronDown, Info, RotateCcw, Save, X, Plus, Pencil, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
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
  const [masterOpen, setMasterOpen] = useState(true);
  const [guardrailsOpen, setGuardrailsOpen] = useState(true);
  const [dowOpen, setDowOpen] = useState(true);
  const [revTargetsOpen, setRevTargetsOpen] = useState(false);
  const [lastMinuteOpen, setLastMinuteOpen] = useState(false);

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

  // Manual overrides refresh trigger
  const [overridesRefreshKey, setOverridesRefreshKey] = useState(0);

  // Tier drafts (in-progress) and pending (queued) tier changes for Advanced section
  const [tierDrafts, setTierDrafts] = useState<{
    occupancy_adjustments?: number[];
    revenue_adjustments_phase_a?: number[];
    revenue_adjustments_phase_b?: number[];
  }>({});
  const [pendingTierChanges, setPendingTierChanges] = useState<{
    occupancy_adjustments?: number[];
    revenue_adjustments_phase_a?: number[];
    revenue_adjustments_phase_b?: number[];
  }>({});

  const pendingRulesCount = Object.keys(pendingRulesChanges).length;
  const pendingBoundsCount = Object.keys(pendingBoundsChanges).length;
  const TIER_KEYS = ['occupancy_adjustments', 'revenue_adjustments_phase_a', 'revenue_adjustments_phase_b'] as const;
  type TierKey = typeof TIER_KEYS[number];
  const pendingTierCount = TIER_KEYS.reduce((acc, key) => {
    const arr = pendingTierChanges[key];
    if (!arr || !rules) return acc;
    const baseline = (rules[key] ?? []) as number[];
    let n = 0;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] !== undefined && arr[i] !== baseline[i]) n++;
    }
    return acc + n;
  }, 0);
  const totalPendingChanges = pendingRulesCount + pendingBoundsCount + pendingTierCount;

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

  // Tier helpers (Advanced section queued-save pattern)
  function resolveTierValue(key: TierKey, idx: number): number {
    const draft = tierDrafts[key]?.[idx];
    if (draft !== undefined) return draft;
    const pending = pendingTierChanges[key]?.[idx];
    if (pending !== undefined) return pending;
    return ((rules?.[key] ?? []) as number[])[idx] ?? 0;
  }
  function setTierDraft(key: TierKey, idx: number, raw: string) {
    const parsed = raw === '' ? 0 : parseFloat(raw);
    setTierDrafts(prev => {
      const arr = [...(prev[key] ?? [])];
      arr[idx] = isNaN(parsed) ? 0 : parsed;
      return { ...prev, [key]: arr };
    });
  }
  function isTierRowDirty(key: TierKey, idx: number): boolean {
    const draft = tierDrafts[key]?.[idx];
    if (draft === undefined) return false;
    const baseline = pendingTierChanges[key]?.[idx] ?? ((rules?.[key] ?? []) as number[])[idx];
    return draft !== baseline;
  }
  const hasAnyDirtyTier = TIER_KEYS.some(k =>
    (tierDrafts[k] ?? []).some((v, i) => v !== undefined && isTierRowDirty(k, i))
  );
  function applyTierChanges() {
    for (const k of TIER_KEYS) {
      const draft = tierDrafts[k];
      if (!draft) continue;
      for (let i = 0; i < draft.length; i++) {
        const v = draft[i];
        if (v === undefined) continue;
        if (!isFinite(v) || v < 0 || v > 100) {
          toast.error('Tier values must be between 0 and 100');
          return;
        }
      }
    }
    setPendingTierChanges(prev => {
      const next = { ...prev };
      for (const k of TIER_KEYS) {
        const draft = tierDrafts[k];
        if (!draft) continue;
        const baseFull = ((next[k] ?? (rules?.[k] ?? [])) as number[]).slice();
        for (let i = 0; i < draft.length; i++) {
          if (draft[i] !== undefined) baseFull[i] = draft[i] as number;
        }
        next[k] = baseFull;
      }
      return next;
    });
    setTierDrafts({});
    toast.success('Tier changes added to pending');
  }
  function discardPendingTierChanges() {
    setPendingTierChanges({});
    setTierDrafts({});
  }
  function labelForTier(key: TierKey, idx: number): string {
    if (!rules) return '';
    if (key === 'occupancy_adjustments') {
      const from = idx === 0 ? 0 : rules.occupancy_thresholds[idx - 1] + 1;
      const to = idx < rules.occupancy_thresholds.length ? rules.occupancy_thresholds[idx] : 100;
      return `Occupancy ${from}-${to}%`;
    }
    const t = rules.revenue_thresholds[idx];
    return `Revenue ≥ ${t}% (${key === 'revenue_adjustments_phase_a' ? 'Phase A' : 'Phase B'})`;
  }

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

  function applyAllBounds() {
    for (const bound of rateBounds) {
      const draft = inputDrafts[bound.room_type] ?? { min: '', max: '' };
      const dMin = parseDraft(draft.min);
      const dMax = parseDraft(draft.max);
      if (dMin !== bound.min_rate || dMax !== bound.max_rate) {
        applyBound(bound.room_type);
      }
    }
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

      // 1. Save pricing_rules changes (merge in queued tier changes)
      const rulesPatch: Partial<PricingRules> = { ...pendingRulesChanges, ...pendingTierChanges };
      const hasRulesChanges = Object.keys(rulesPatch).length > 0;
      if (hasRulesChanges) {
        const { error } = await supabase
          .from('pricing_rules')
          .update(toDbRow(rulesPatch))
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

      // Update local rules baseline so UI reflects new tier values immediately
      if (hasRulesChanges) {
        setRules(prev => prev ? { ...prev, ...rulesPatch } as PricingRules : prev);
      }

      // Trigger Channex full-sync if rules/tier changes affect calculated rates (non-fatal)
      const triggeredFullSync = (pendingRulesCount > 0 || pendingTierCount > 0) && !!propertyId;
      let fullSyncFailed = false;
      if (triggeredFullSync) {
        setSaveProgress(90);
        try {
          const { error: syncErr } = await supabase.functions.invoke('channex-full-sync', {
            body: { propertyId },
          });
          if (syncErr) fullSyncFailed = true;
        } catch {
          fullSyncFailed = true;
        }
      }

      setSaveProgress(100);
      setSaveStatus('success');
      setPendingRulesChanges({});
      setPendingBoundsChanges({});
      setPendingTierChanges({});
      setTierDrafts({});

      if (triggeredFullSync) {
        if (fullSyncFailed) {
          toast.error('Settings saved. Channex sync failed — please retry sync.');
        } else {
          toast.success('Settings saved and synced to Channex');
        }
      } else {
        toast.success(hasBoundsChanges ? 'Pricing settings saved and synced to Channex' : 'Pricing settings saved');
      }

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
          <Collapsible open={masterOpen} onOpenChange={setMasterOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Enable Dynamic Pricing</CardTitle>
                      <CardDescription>When enabled, rates are automatically adjusted based on occupancy, pace, and revenue targets.</CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={rules.is_enabled}
                          onCheckedChange={(checked) => updateRules({ is_enabled: checked })}
                        />
                      </div>
                      <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${masterOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {!rules.is_enabled && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Dynamic pricing is disabled. Rates from Rate Plans will be used as-is.</p>
                  </CardContent>
                )}
              </CollapsibleContent>
            </Card>
          </Collapsible>

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
                        {rateBounds.map((bound) => {
                          const draft = inputDrafts[bound.room_type] ?? { min: '', max: '' };
                          const draftMin = parseDraft(draft.min);
                          const draftMax = parseDraft(draft.max);
                          const ratio = weekendRatio(bound);
                          const savedMin = bound.min_rate;
                          const savedMax = bound.max_rate;
                          const isDirty = draftMin !== savedMin || draftMax !== savedMax;
                          // Effective values for OTA preview: prefer draft, else saved
                          const effMin = draftMin ?? savedMin;
                          const effMax = draftMax ?? savedMax;
                          return (
                            <>
                              <TableRow key={bound.room_type}>
                                <TableCell className="font-medium align-top">{bound.room_type}</TableCell>
                                <TableCell className="text-right align-top">{bound.weekday_rate.toFixed(2)}</TableCell>
                                <TableCell className="text-right align-top">{bound.weekend_rate.toFixed(2)}</TableCell>
                                <TableCell className="text-right align-top">
                                  <div className="flex flex-col items-end gap-1">
                                    <Input
                                      type="number"
                                      step="1"
                                      placeholder="No minimum"
                                      className="w-28 text-right"
                                      value={draft.min}
                                      onChange={(e) => setDraft(bound.room_type, 'min', e.target.value)}
                                    />
                                    {draftMin !== null && (
                                      <span className="text-xs text-muted-foreground">
                                        Weekend: {formatUsd(draftMin * ratio)}
                                      </span>
                                    )}
                                    {boundsErrors[bound.room_type] && (
                                      <p className="text-xs text-destructive">{boundsErrors[bound.room_type]}</p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right align-top">
                                  <div className="flex flex-col items-end gap-1">
                                    <Input
                                      type="number"
                                      step="1"
                                      placeholder="No maximum"
                                      className="w-28 text-right"
                                      value={draft.max}
                                      onChange={(e) => setDraft(bound.room_type, 'max', e.target.value)}
                                    />
                                    {draftMax !== null && (
                                      <span className="text-xs text-muted-foreground">
                                        Weekend: {formatUsd(draftMax * ratio)}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow key={`${bound.room_type}-ota`} className="border-b">
                                <TableCell colSpan={5} className="bg-muted/30 py-2">
                                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                                    {channelMarkups.length === 0 ? (
                                      <span>No OTA channels connected</span>
                                    ) : (
                                      channelMarkups.map((ch) => (
                                        <div key={ch.id} className="flex items-center gap-2 flex-wrap">
                                          <Badge variant="secondary" className="text-[10px]">{ch.channel_name}</Badge>
                                          <span className="text-[11px]">+{Number(ch.markup_percentage)}%</span>
                                          <span>
                                            Min on {ch.channel_name}: {formatUsd(withMarkup(effMin, Number(ch.markup_percentage)))}
                                          </span>
                                          <span>·</span>
                                          <span>
                                            Max on {ch.channel_name}: {formatUsd(withMarkup(effMax, Number(ch.markup_percentage)))}
                                          </span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            </>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-muted rounded-md">
                    <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">These bounds are also synced to your channel manager as a safety net. Channex will reject any rate outside these bounds even if the PMS has a bug.</p>
                  </div>
                  {(() => {
                    const anyDirty = rateBounds.some((b) => {
                      const d = inputDrafts[b.room_type] ?? { min: '', max: '' };
                      return parseDraft(d.min) !== b.min_rate || parseDraft(d.max) !== b.max_rate;
                    });
                    return (
                      <div className="flex items-center justify-between gap-4">
                        {lastChannexSync ? (
                          <p className="text-xs text-muted-foreground">Last synced to Channex: {lastChannexSync}</p>
                        ) : (
                          <span />
                        )}
                        {anyDirty && (
                          <Button
                            onClick={applyAllBounds}
                            className="bg-black text-white hover:bg-black/90"
                          >
                            Apply Changes
                          </Button>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Pending Rate Bound Changes */}
              {Object.keys(pendingBoundsChanges).length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Pending Changes</CardTitle>
                    <CardDescription>
                      {Object.keys(pendingBoundsChanges).length} rate bound change(s) ready to save
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(pendingBoundsChanges).map(([roomType, change]) => {
                        const bound = rateBounds.find((b) => b.room_type === roomType);
                        if (!bound) return null;
                        const ratio = weekendRatio(bound);
                        const minChanged = change.original.min !== change.pending.min;
                        const maxChanged = change.original.max !== change.pending.max;
                        return (
                          <div
                            key={roomType}
                            className="flex items-start justify-between p-3 bg-muted/50 rounded-lg"
                          >
                            <div className="space-y-1.5 min-w-0">
                              <div className="font-medium text-sm">{roomType}</div>
                              <div className="flex flex-wrap gap-1.5">
                                {minChanged && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    Min Rate: {formatUsd(change.original.min)} → {formatUsd(change.pending.min)}
                                  </Badge>
                                )}
                                {maxChanged && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    Max Rate: {formatUsd(change.original.max)} → {formatUsd(change.pending.max)}
                                  </Badge>
                                )}
                              </div>
                              {channelMarkups.length > 0 && (
                                <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                                  {channelMarkups.map((ch) => {
                                    const pct = Number(ch.markup_percentage);
                                    return (
                                      <div key={ch.id} className="flex flex-wrap gap-x-3">
                                        {minChanged && (
                                          <span>
                                            {ch.channel_name} min: {formatUsd(withMarkup(change.original.min, pct))} → {formatUsd(withMarkup(change.pending.min, pct))}
                                          </span>
                                        )}
                                        {maxChanged && (
                                          <span>
                                            {ch.channel_name} max: {formatUsd(withMarkup(change.original.max, pct))} → {formatUsd(withMarkup(change.pending.max, pct))}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground space-x-3 pt-0.5">
                                {minChanged && (
                                  <span>
                                    Weekend min: {formatUsd((change.original.min ?? 0) * ratio)} → {formatUsd((change.pending.min ?? 0) * ratio)}
                                  </span>
                                )}
                                {maxChanged && (
                                  <span>
                                    Weekend max: {formatUsd((change.original.max ?? 0) * ratio)} → {formatUsd((change.pending.max ?? 0) * ratio)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 shrink-0"
                              onClick={() => removePendingBound(roomType)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

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
                              const dirty = isTierRowDirty('occupancy_adjustments', idx);
                              return (
                                <TableRow key={idx}>
                                  <TableCell>{from}%</TableCell>
                                  <TableCell>{to}%</TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      className={cn('w-20', dirty && 'border-amber-500')}
                                      value={resolveTierValue('occupancy_adjustments', idx)}
                                      onChange={(e) => setTierDraft('occupancy_adjustments', idx, e.target.value)}
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
                            {rules.revenue_thresholds.map((thresh, idx) => {
                              const dirtyA = isTierRowDirty('revenue_adjustments_phase_a', idx);
                              const dirtyB = isTierRowDirty('revenue_adjustments_phase_b', idx);
                              return (
                                <TableRow key={idx}>
                                  <TableCell>{thresh}%</TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      className={cn('w-20', dirtyA && 'border-amber-500')}
                                      value={resolveTierValue('revenue_adjustments_phase_a', idx)}
                                      onChange={(e) => setTierDraft('revenue_adjustments_phase_a', idx, e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      className={cn('w-20', dirtyB && 'border-amber-500')}
                                      value={resolveTierValue('revenue_adjustments_phase_b', idx)}
                                      onChange={(e) => setTierDraft('revenue_adjustments_phase_b', idx, e.target.value)}
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Apply Changes for tier edits */}
                      <div className="flex justify-end pt-2">
                        {hasAnyDirtyTier && (
                          <Button
                            type="button"
                            onClick={applyTierChanges}
                            className="bg-black text-white hover:bg-black/90"
                            size="sm"
                          >
                            Apply Changes
                          </Button>
                        )}
                      </div>

                      {pendingTierCount > 0 && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-medium">
                              {pendingTierCount} tier change{pendingTierCount === 1 ? '' : 's'} ready to save
                            </span>
                            <Button type="button" variant="ghost" size="sm" onClick={discardPendingTierChanges}>
                              Discard
                            </Button>
                          </div>
                          <ul className="text-xs text-muted-foreground space-y-0.5">
                            {TIER_KEYS.flatMap(k => {
                              const arr = pendingTierChanges[k] ?? [];
                              const baseline = (rules[k] ?? []) as number[];
                              return arr
                                .map((v, i) =>
                                  v !== undefined && v !== baseline[i] ? (
                                    <li key={`${k}-${i}`}>
                                      {labelForTier(k, i)}: {baseline[i]}% → {v}%
                                    </li>
                                  ) : null
                                )
                                .filter(Boolean);
                            })}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </>
          )}

          {/* Pricing Dashboard */}
          <PricingDashboard
            propertyId={propertyId}
            rules={rules}
            overridesRefreshKey={overridesRefreshKey}
            onOverridesChanged={() => setOverridesRefreshKey(k => k + 1)}
          />

          {/* Manual Overrides */}
          <OverridesSection
            propertyId={propertyId}
            refreshKey={overridesRefreshKey}
            onChanged={() => setOverridesRefreshKey(k => k + 1)}
          />
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

// ============================================================================
// Pricing Dashboard
// ============================================================================

interface MonthSummary {
  key: string; // YYYY-MM
  label: string;
  monthStart: string;
  monthEndExclusive: string;
  monthEndInclusive: string;
  daysInMonth: number;
  phase: 'A' | 'B';
  bookedNights: number;
  totalAvailableNights: number;
  occupancyPercent: number;
  paceIndex: number | null;
  revenueTotal: number;
  revenueTarget: number | null;
  occAdjustmentPercent: number;
  revAdjustmentPercent: number;
  overridesCount: number;
}

interface PreviewRow {
  target_date: string;
  base_rate: number;
  final_rate: number;
  adjustments: {
    day_of_week_multiplier: number;
    occupancy_adjustment: number;
    revenue_adjustment: number;
    occupancy_percent?: number | null;
    month_phase?: string | null;
    override_active: boolean;
    was_clamped?: boolean;
    clamp_direction?: 'floor' | 'ceiling' | null;
    promotion_applied?: { id: string; discount_percent: number } | null;
  };
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function ymdAddDays(ymd: string, n: number): string {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function tierIndex(value: number, thresholds: number[]): number {
  let i = 0;
  for (; i < thresholds.length; i++) {
    if (value < Number(thresholds[i])) return i;
  }
  return i;
}

function PricingDashboard({ propertyId, rules, overridesRefreshKey, onOverridesChanged }: { propertyId: string; rules: PricingRules; overridesRefreshKey: number; onOverridesChanged: () => void }) {
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [activeRatePlans, setActiveRatePlans] = useState<Array<{ id: string; room_type: string; name: string }>>([]);
  const [selectedRatePlan, setSelectedRatePlan] = useState<{ id: string; room_type: string } | null>(null);
  const [monthSummaries, setMonthSummaries] = useState<MonthSummary[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [previewByMonth, setPreviewByMonth] = useState<Record<string, PreviewRow[]>>({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [roomTypes, setRoomTypes] = useState<string[]>([]);
  const [quickDialog, setQuickDialog] = useState<{ open: boolean; initial: OverrideDialogInitial | undefined }>({ open: false, initial: undefined });
  const [briefOpen, setBriefOpen] = useState(false);

  // Load cards data
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!propertyId) return;
      setDashboardLoading(true);
      try {
        // Property meta
        const { data: property } = await supabase
          .from('properties')
          .select('timezone, weekend_days, off_peak_days')
          .eq('id', propertyId)
          .maybeSingle();
        const tz = property?.timezone || 'Africa/Cairo';
        const todayStrInTz = new Date().toLocaleDateString('en-CA', { timeZone: tz });

        // Build 6 month windows starting current month
        const [tyStr, tmStr] = todayStrInTz.split('-');
        const baseYear = Number(tyStr);
        const baseMonth0 = Number(tmStr) - 1;

        const windows = [] as Array<{ key: string; year: number; month0: number; daysInMonth: number; monthStart: string; monthEndExclusive: string; monthEndInclusive: string; phase: 'A'|'B' }>;
        for (let i = 0; i < 6; i++) {
          const y = baseYear + Math.floor((baseMonth0 + i) / 12);
          const m0 = (baseMonth0 + i) % 12;
          const dim = new Date(y, m0 + 1, 0).getDate();
          const monthStart = `${y}-${String(m0 + 1).padStart(2,'0')}-01`;
          const monthEndInclusive = `${y}-${String(m0 + 1).padStart(2,'0')}-${String(dim).padStart(2,'0')}`;
          const monthEndExclusive = ymdAddDays(monthEndInclusive, 1);
          const phase: 'A' | 'B' = (monthStart <= todayStrInTz && todayStrInTz <= monthEndInclusive) ? 'B' : 'A';
          windows.push({ key: monthStart.slice(0,7), year: y, month0: m0, daysInMonth: dim, monthStart, monthEndExclusive, monthEndInclusive, phase });
        }

        const windowStart = windows[0].monthStart;
        const windowEndExclusive = windows[windows.length - 1].monthEndExclusive;

        // Active rate plans (room_type lives on rate_plan_prices, not rate_plans)
        const { data: ratePlanRows } = await supabase
          .from('rate_plans')
          .select('id, name, rate_plan_prices!inner(room_type, unit_id)')
          .eq('property_id', propertyId)
          .eq('is_active', true)
          .not('name', 'ilike', '%archived%')
          .is('rate_plan_prices.unit_id', null)
          .order('created_at', { ascending: true });

        const plans = (ratePlanRows ?? [])
          .map((rp: any) => {
            const priceRows = Array.isArray(rp.rate_plan_prices) ? rp.rate_plan_prices : [rp.rate_plan_prices];
            const firstRoomType = priceRows[0]?.room_type;
            return firstRoomType ? { id: rp.id as string, room_type: firstRoomType as string, name: rp.name as string } : null;
          })
          .filter((p): p is { id: string; room_type: string; name: string } => p !== null);

        // Active units
        const { data: unitsData } = await supabase
          .from('units')
          .select('id, booking_com_name')
          .eq('property_id', propertyId)
          .neq('status', 'maintenance');
        const units = (unitsData ?? []) as { id: string; booking_com_name: string | null }[];
        const unitIds = units.map(u => u.id);
        const distinctRoomTypes = Array.from(new Set(units.map(u => u.booking_com_name).filter((v): v is string => !!v))).sort();

        // Reservations across full window
        let reservations: any[] = [];
        if (unitIds.length > 0) {
          const { data: resData } = await supabase
            .from('reservations')
            .select('unit_id, property_id, status, check_in_date, check_out_date, total_price')
            .in('status', ['confirmed', 'checked-in'])
            .in('unit_id', unitIds)
            .lt('check_in_date', windowEndExclusive)
            .gt('check_out_date', windowStart);
          reservations = (resData ?? []) as any[];
        }

        // Overrides
        const { data: overridesData } = await supabase
          .from('pricing_overrides')
          .select('override_date')
          .eq('property_id', propertyId)
          .gte('override_date', windowStart)
          .lt('override_date', windowEndExclusive);
        const overrides = (overridesData ?? []) as { override_date: string }[];

        // Compute per-month summaries
        const occThresholds = (rules.occupancy_thresholds || []).map(Number);
        const occAdjustments = (rules.occupancy_adjustments || []).map(Number);
        const revThresholds = (rules.revenue_thresholds || []).map(Number);
        const revAdjA = (rules.revenue_adjustments_phase_a || []).map(Number);
        const revAdjB = (rules.revenue_adjustments_phase_b || []).map(Number);
        const paceBumpThreshold = Number(rules.pace_index_bump_threshold ?? 1.3);
        const monthlyTarget = rules.monthly_revenue_target != null ? Number(rules.monthly_revenue_target) : 0;
        const conflictCap = Number(rules.revenue_occupancy_conflict_cap ?? 5);
        const conflictRevMin = Number(rules.revenue_occupancy_conflict_revenue_min ?? 80);
        const conflictOccMax = Number(rules.revenue_occupancy_conflict_occupancy_max ?? 40);

        const summaries: MonthSummary[] = windows.map((w) => {
          // Booked nights overlap
          let bookedNights = 0;
          for (const r of reservations) {
            const ci = r.check_in_date as string;
            const co = r.check_out_date as string;
            if (!(ci < w.monthEndExclusive && co > w.monthStart)) continue;
            const overlapStart = ci > w.monthStart ? ci : w.monthStart;
            const overlapEndExclusive = co < w.monthEndExclusive ? co : w.monthEndExclusive;
            if (overlapEndExclusive > overlapStart) {
              const a = new Date(overlapStart + 'T00:00:00Z').getTime();
              const b = new Date(overlapEndExclusive + 'T00:00:00Z').getTime();
              const nights = Math.round((b - a) / 86400000);
              if (nights > 0) bookedNights += nights;
            }
          }
          const totalAvailableNights = units.length * w.daysInMonth;
          const occupancyPercent = totalAvailableNights > 0 ? (bookedNights / totalAvailableNights) * 100 : 0;

          // Pace (Phase B only)
          let paceIndex: number | null = null;
          if (w.phase === 'B') {
            const todayDate = new Date(todayStrInTz + 'T00:00:00Z');
            const monthStartDate = new Date(w.monthStart + 'T00:00:00Z');
            const daysElapsed = Math.round((todayDate.getTime() - monthStartDate.getTime()) / 86400000) + 1;
            const daysElapsedPercent = (daysElapsed / w.daysInMonth) * 100;
            paceIndex = daysElapsedPercent <= 0 ? 1.0 : occupancyPercent / daysElapsedPercent;
          }

          // Revenue (phase-aware)
          let revenueTotal = 0;
          for (const r of reservations) {
            if (r.property_id !== propertyId) continue;
            const ci = r.check_in_date as string;
            const co = r.check_out_date as string;
            if (w.phase === 'A') {
              if (ci >= w.monthStart && ci < w.monthEndExclusive) revenueTotal += Number(r.total_price ?? 0);
            } else {
              if (ci < w.monthEndExclusive && co > w.monthStart) revenueTotal += Number(r.total_price ?? 0);
            }
          }

          // Occupancy adjustment + pace bump
          let occTier = tierIndex(occupancyPercent, occThresholds);
          if (w.phase === 'B' && paceIndex !== null && paceIndex >= paceBumpThreshold) {
            if (occTier < occAdjustments.length - 1) occTier += 1;
          }
          const occAdjustmentPercent = rules.is_enabled ? Number(occAdjustments[occTier] ?? 0) : 0;

          // Revenue adjustment
          let revAdjustmentPercent = 0;
          if (rules.is_enabled && monthlyTarget > 0) {
            const revAchievement = (revenueTotal / monthlyTarget) * 100;
            const revTier = tierIndex(revAchievement, revThresholds);
            const arr = w.phase === 'B' ? revAdjB : revAdjA;
            revAdjustmentPercent = Number(arr[revTier] ?? 0);
            if (revAchievement > conflictRevMin && occupancyPercent < conflictOccMax && revAdjustmentPercent > conflictCap) {
              revAdjustmentPercent = conflictCap;
            }
          }

          const overridesCount = overrides.filter(o => o.override_date >= w.monthStart && o.override_date < w.monthEndExclusive).length;

          return {
            key: w.key,
            label: `${MONTH_NAMES[w.month0]} ${w.year}`,
            monthStart: w.monthStart,
            monthEndExclusive: w.monthEndExclusive,
            monthEndInclusive: w.monthEndInclusive,
            daysInMonth: w.daysInMonth,
            phase: w.phase,
            bookedNights,
            totalAvailableNights,
            occupancyPercent,
            paceIndex,
            revenueTotal,
            revenueTarget: monthlyTarget > 0 ? monthlyTarget : null,
            occAdjustmentPercent,
            revAdjustmentPercent,
            overridesCount,
          };
        });

        if (cancelled) return;
        setActiveRatePlans(plans);
        setSelectedRatePlan(prev => prev ?? (plans[0] ? { id: plans[0].id, room_type: plans[0].room_type } : null));
        setMonthSummaries(summaries);
        setSelectedMonth(prev => prev || summaries[0]?.key || '');
        setRoomTypes(distinctRoomTypes);
      } catch (err) {
        console.error('Failed to load pricing dashboard', err);
      } finally {
        if (!cancelled) setDashboardLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [propertyId, rules]);

  // Load preview for selected month + rate plan (cached)
  useEffect(() => {
    let cancelled = false;
    async function loadPreview() {
      if (!selectedMonth || !selectedRatePlan || !propertyId) return;
      const previewKey = `${selectedMonth}_${selectedRatePlan.id}`;
      if (previewByMonth[previewKey]) return;
      const summary = monthSummaries.find(s => s.key === selectedMonth);
      if (!summary) return;

      setPreviewLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('calculate-dynamic-price-batch', {
          body: {
            property_id: propertyId,
            room_type: selectedRatePlan.room_type,
            rate_plan_id: selectedRatePlan.id,
            date_from: summary.monthStart,
            date_to: summary.monthEndInclusive,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (cancelled) return;
        setPreviewByMonth(prev => ({ ...prev, [previewKey]: (data?.rates ?? []) as PreviewRow[] }));
      } catch (err: any) {
        console.error('Failed to load rate preview', err);
        toast.error(err?.message || 'Failed to load rate preview');
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }
    loadPreview();
    return () => { cancelled = true; };
  }, [selectedMonth, selectedRatePlan, propertyId, monthSummaries, previewByMonth]);

  // Clear preview cache when overrides change so the table refreshes
  useEffect(() => {
    setPreviewByMonth({});
  }, [overridesRefreshKey]);

  const previewRows = previewByMonth[`${selectedMonth}_${selectedRatePlan?.id ?? ''}`] ?? [];

  async function openExistingOverride(targetDate: string) {
    if (!selectedRatePlan) return;
    const { data: matches } = await supabase
      .from('pricing_overrides')
      .select('*')
      .eq('property_id', propertyId)
      .eq('override_date', targetDate)
      .or(`room_type.eq.${selectedRatePlan.room_type},room_type.is.null`);
    const specific = matches?.find((m: any) => m.room_type === selectedRatePlan.room_type);
    const wildcard = matches?.find((m: any) => m.room_type === null);
    const existing: any = specific ?? wildcard;
    if (!existing) {
      toast.error('Override not found');
      return;
    }
    setQuickDialog({
      open: true,
      initial: {
        id: existing.id,
        override_date: existing.override_date,
        room_type: existing.room_type,
        override_type: existing.override_type,
        value: Number(existing.value),
        reason: existing.reason ?? '',
      },
    });
  }

  function openAddOverrideForDate(targetDate: string, suggestedRate: number) {
    if (!selectedRatePlan) return;
    setQuickDialog({
      open: true,
      initial: {
        override_date: targetDate,
        room_type: selectedRatePlan.room_type,
        override_type: 'fixed_rate',
        value: Math.round(suggestedRate),
        reason: '',
      },
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Pricing Dashboard</CardTitle>
          <CardDescription>Live view of how the algorithm is reading each month and what it would price today.</CardDescription>
        </div>
        <Button
          onClick={() => setBriefOpen(true)}
          disabled={!selectedMonth || !selectedRatePlan || activeRatePlans.length === 0}
        >
          Pricing Brief
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {dashboardLoading && monthSummaries.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Month cards */}
            <div className="overflow-x-auto -mx-2 px-2">
              <div className="flex gap-3 pb-2" style={{ minWidth: 'max-content' }}>
                {monthSummaries.map(m => {
                  const isSelected = m.key === selectedMonth;
                  const occPct = Math.min(100, Math.round(m.occupancyPercent));
                  const revPct = m.revenueTarget ? Math.min(100, Math.round((m.revenueTotal / m.revenueTarget) * 100)) : 0;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setSelectedMonth(m.key)}
                      className={cn(
                        'text-left rounded-lg border bg-card p-4 w-[240px] flex-shrink-0 transition-all hover:shadow-sm',
                        isSelected && 'ring-2 ring-primary border-primary'
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-sm">{m.label}</div>
                        <Badge
                          variant={m.phase === 'B' ? 'default' : 'secondary'}
                          className={cn(
                            m.phase === 'B' && 'bg-green-600 hover:bg-green-600 text-white',
                            m.phase === 'A' && 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                          )}
                        >
                          {m.phase === 'B' ? 'Active' : 'Future'}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-muted-foreground">Occupancy</span>
                            <span className="font-medium">{occPct}%</span>
                          </div>
                          <Progress value={occPct} className="h-1.5" />
                        </div>

                        {m.phase === 'B' && m.paceIndex !== null && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Pace Index</span>
                            <span className="font-medium">{m.paceIndex.toFixed(2)}x</span>
                          </div>
                        )}

                        {m.revenueTarget !== null && (
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-muted-foreground">Revenue</span>
                              <span className="font-medium">${Math.round(m.revenueTotal).toLocaleString()} / ${Math.round(m.revenueTarget).toLocaleString()}</span>
                            </div>
                            <Progress value={revPct} className="h-1.5" />
                          </div>
                        )}

                        <div className="pt-1 border-t">
                          <div className="text-muted-foreground mb-0.5">Active adjustment</div>
                          <div className="font-medium">
                            {m.occAdjustmentPercent >= 0 ? '+' : ''}{m.occAdjustmentPercent}% occ,{' '}
                            {m.revAdjustmentPercent >= 0 ? '+' : ''}{m.revAdjustmentPercent}% rev
                          </div>
                        </div>

                        <div className="text-muted-foreground">
                          {m.overridesCount} manual override{m.overridesCount === 1 ? '' : 's'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rate Preview Table */}
            <div>
              <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                <h3 className="text-sm font-semibold">
                  Preview — {monthSummaries.find(s => s.key === selectedMonth)?.label ?? ''}
                  {selectedRatePlan && <span className="text-muted-foreground font-normal"> · {selectedRatePlan.room_type}</span>}
                </h3>
                <div className="flex items-center gap-2">
                  {previewLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {activeRatePlans.length > 0 && (
                    <Select
                      value={selectedRatePlan?.id ?? ''}
                      onValueChange={(val) => {
                        const p = activeRatePlans.find(rp => rp.id === val);
                        if (p) setSelectedRatePlan({ id: p.id, room_type: p.room_type });
                      }}
                    >
                      <SelectTrigger className="h-9 w-[220px]">
                        <SelectValue placeholder="Select room type" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeRatePlans.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.room_type}{p.name ? ` — ${p.name}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {activeRatePlans.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No active rate plans configured for this property.</p>
              ) : previewLoading && previewRows.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Day</TableHead>
                        <TableHead className="text-right">Base Rate</TableHead>
                        <TableHead className="text-right">Day Mult</TableHead>
                        <TableHead className="text-right">Occ Adj</TableHead>
                        <TableHead className="text-right">Rev Adj</TableHead>
                        <TableHead className="text-right">Final Rate</TableHead>
                        <TableHead>Override</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map(row => {
                        const dow = new Date(row.target_date + 'T00:00:00Z').getUTCDay();
                        const dayLabel = DAY_LABELS[dow];
                        const isOverride = row.adjustments.override_active;
                        const tint = isOverride
                          ? 'bg-blue-50/60 dark:bg-blue-950/20'
                          : row.final_rate > row.base_rate
                            ? 'bg-green-50/60 dark:bg-green-950/20'
                            : row.final_rate < row.base_rate
                              ? 'bg-orange-50/60 dark:bg-orange-950/20'
                              : '';
                        return (
                          <TableRow key={row.target_date} className={tint}>
                            <TableCell className="font-mono text-xs">{row.target_date}</TableCell>
                            <TableCell className="text-xs">{dayLabel}</TableCell>
                            <TableCell className="text-right">${Math.round(row.base_rate).toLocaleString()}</TableCell>
                            <TableCell className="text-right">×{Number(row.adjustments.day_of_week_multiplier ?? 1).toFixed(2)}</TableCell>
                            <TableCell className="text-right">{row.adjustments.occupancy_adjustment >= 0 ? '+' : ''}{row.adjustments.occupancy_adjustment}%</TableCell>
                            <TableCell className="text-right">{row.adjustments.revenue_adjustment >= 0 ? '+' : ''}{row.adjustments.revenue_adjustment}%</TableCell>
                            <TableCell className="text-right font-semibold">${Math.round(row.final_rate).toLocaleString()}</TableCell>
                            <TableCell>
                              {isOverride ? (
                                <button
                                  type="button"
                                  onClick={() => openExistingOverride(row.target_date)}
                                  className="inline-flex"
                                >
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer">Override</Badge>
                                </button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => openAddOverrideForDate(row.target_date, row.final_rate)}
                                  aria-label="Add override"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {previewRows.length === 0 && !previewLoading && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-4">No preview data available.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
      <OverrideDialog
        open={quickDialog.open}
        onOpenChange={(o) => setQuickDialog(prev => ({ ...prev, open: o }))}
        propertyId={propertyId}
        roomTypes={roomTypes}
        initial={quickDialog.initial}
        allowDateRange={false}
        onSaved={() => {
          setQuickDialog({ open: false, initial: undefined });
          setPreviewByMonth({});
          onOverridesChanged();
        }}
      />
      <PricingBriefDialog
        open={briefOpen}
        onOpenChange={setBriefOpen}
        propertyId={propertyId}
        rules={rules}
        monthSummaries={monthSummaries}
        activeRatePlans={activeRatePlans}
        previewByMonth={previewByMonth}
        setPreviewByMonth={setPreviewByMonth}
        initialMonthKey={selectedMonth}
        initialRatePlanId={selectedRatePlan?.id ?? ''}
      />
    </Card>
  );
}

// ============================================================================
// Pricing Brief Dialog
// ============================================================================

const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface PromoRow {
  id: string;
  name: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  booking_window_start: string;
  booking_window_end: string;
  stay_start: string;
  stay_end: string;
  room_types: string[] | null;
}

interface BoundsRow {
  weekday_rate: number;
  weekend_rate: number;
  min_rate: number | null;
  max_rate: number | null;
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null || !isFinite(Number(n))) return '—';
  return `$${Math.round(Number(n)).toLocaleString()}`;
}

function fmtPct(n: number | null | undefined, withSign = false): string {
  if (n == null || !isFinite(Number(n))) return '—';
  const v = Number(n);
  const sign = withSign && v >= 0 ? '+' : '';
  return `${sign}${Math.round(v * 10) / 10}%`;
}

function PricingBriefDialog({
  open, onOpenChange, propertyId, rules, monthSummaries, activeRatePlans,
  previewByMonth, setPreviewByMonth, initialMonthKey, initialRatePlanId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  propertyId: string;
  rules: PricingRules;
  monthSummaries: MonthSummary[];
  activeRatePlans: Array<{ id: string; room_type: string; name: string }>;
  previewByMonth: Record<string, PreviewRow[]>;
  setPreviewByMonth: React.Dispatch<React.SetStateAction<Record<string, PreviewRow[]>>>;
  initialMonthKey: string;
  initialRatePlanId: string;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [ratePlanId, setRatePlanId] = useState(initialRatePlanId);
  const [loading, setLoading] = useState(false);
  const [overrideCount, setOverrideCount] = useState(0);
  const [activePromotion, setActivePromotion] = useState<PromoRow | null>(null);
  const [bounds, setBounds] = useState<BoundsRow | null>(null);
  const [weekendDays, setWeekendDays] = useState<number[]>([]);

  useEffect(() => {
    if (open) {
      setMonthKey(initialMonthKey);
      setRatePlanId(initialRatePlanId);
    }
  }, [open, initialMonthKey, initialRatePlanId]);

  const summary = monthSummaries.find(s => s.key === monthKey);
  const plan = activeRatePlans.find(p => p.id === ratePlanId);
  const previewKey = `${monthKey}_${ratePlanId}`;
  const previewRows = previewByMonth[previewKey] ?? [];

  useEffect(() => {
    if (!open || !summary || !plan || !propertyId) return;
    let cancelled = false;
    async function loadAll() {
      setLoading(true);
      try {
        const needPreview = !previewByMonth[previewKey];
        const [propRes, boundsRes, overrideRes, promoRes, previewRes] = await Promise.all([
          supabase.from('properties').select('weekend_days').eq('id', propertyId).maybeSingle(),
          supabase.from('rate_plan_prices')
            .select('weekday_rate, weekend_rate, min_rate, max_rate')
            .eq('rate_plan_id', plan!.id)
            .eq('room_type', plan!.room_type)
            .is('unit_id', null)
            .maybeSingle(),
          supabase.from('pricing_overrides')
            .select('id', { count: 'exact', head: true })
            .eq('property_id', propertyId)
            .gte('override_date', summary!.monthStart)
            .lt('override_date', summary!.monthEndExclusive)
            .or(`room_type.eq.${plan!.room_type},room_type.is.null`),
          supabase.from('promotional_periods')
            .select('id, name, discount_type, discount_value, booking_window_start, booking_window_end, stay_start, stay_end, room_types')
            .eq('property_id', propertyId)
            .eq('is_active', true)
            .lte('stay_start', summary!.monthEndInclusive)
            .gte('stay_end', summary!.monthStart),
          needPreview
            ? supabase.functions.invoke('calculate-dynamic-price-batch', {
                body: {
                  property_id: propertyId,
                  room_type: plan!.room_type,
                  rate_plan_id: plan!.id,
                  date_from: summary!.monthStart,
                  date_to: summary!.monthEndInclusive,
                },
              })
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        setWeekendDays((propRes.data?.weekend_days as number[] | null) ?? [4, 5]);
        setBounds((boundsRes.data as BoundsRow | null) ?? null);
        setOverrideCount(overrideRes.count ?? 0);

        const promos = (promoRes.data as PromoRow[] | null) ?? [];
        const matched = promos.find(p =>
          !p.room_types || p.room_types.length === 0 || p.room_types.includes(plan!.room_type)
        );
        setActivePromotion(matched ?? null);

        if (needPreview && previewRes && (previewRes as any).data?.rates) {
          const rates = (previewRes as any).data.rates as PreviewRow[];
          setPreviewByMonth(prev => ({ ...prev, [previewKey]: rates }));
        }
      } catch (err) {
        console.error('Failed to load Pricing Brief data', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAll();
    return () => { cancelled = true; };
  }, [open, monthKey, ratePlanId, propertyId, summary, plan, previewKey, previewByMonth, setPreviewByMonth]);

  const isLoading = loading || !summary || !plan || previewRows.length === 0;

  // ---------- Computed brief content ----------
  const monthlyTarget = rules.monthly_revenue_target != null ? Number(rules.monthly_revenue_target) : 0;
  const occThresholds = (rules.occupancy_thresholds || []).map(Number);
  const occAdjustments = (rules.occupancy_adjustments || []).map(Number);
  const revThresholds = (rules.revenue_thresholds || []).map(Number);
  const revAdjA = (rules.revenue_adjustments_phase_a || []).map(Number);
  const revAdjB = (rules.revenue_adjustments_phase_b || []).map(Number);
  const paceBumpThreshold = Number(rules.pace_index_bump_threshold ?? 1.3);
  const conflictCap = Number(rules.revenue_occupancy_conflict_cap ?? 5);
  const conflictRevMin = Number(rules.revenue_occupancy_conflict_revenue_min ?? 80);
  const conflictOccMax = Number(rules.revenue_occupancy_conflict_occupancy_max ?? 40);

  let demandText: React.ReactNode = null;
  if (summary) {
    const revPctOfTarget = summary.revenueTarget && summary.revenueTarget > 0
      ? (summary.revenueTotal / summary.revenueTarget) * 100 : 0;
    let paceLine: React.ReactNode = null;
    if (summary.phase === 'B' && summary.paceIndex != null) {
      const today = new Date().toLocaleDateString('en-CA');
      const monthStartDate = new Date(summary.monthStart + 'T00:00:00Z');
      const todayDate = new Date(today + 'T00:00:00Z');
      const daysElapsed = Math.round((todayDate.getTime() - monthStartDate.getTime()) / 86400000) + 1;
      const expectedPct = Math.max(0, Math.min(100, (daysElapsed / summary.daysInMonth) * 100));
      if (summary.paceIndex >= 1.0) {
        paceLine = (
          <p>You're filling <strong>faster</strong> than expected — at this point in the month you should be around <strong>{expectedPct.toFixed(0)}%</strong> booked, but you're at <strong>{summary.occupancyPercent.toFixed(0)}%</strong>. That's a Pace Index of <strong>{summary.paceIndex.toFixed(2)}x</strong>, which means demand is strong.</p>
        );
      } else {
        paceLine = (
          <p>You're filling <strong>slower</strong> than expected — at this point in the month you'd typically be around <strong>{expectedPct.toFixed(0)}%</strong> booked, but you're at <strong>{summary.occupancyPercent.toFixed(0)}%</strong>. That's a Pace Index of <strong>{summary.paceIndex.toFixed(2)}x</strong>, indicating softer demand.</p>
        );
      }
    } else {
      paceLine = <p>This is a future month, so the algorithm uses confirmed bookings only. Pace Index doesn't apply yet.</p>;
    }
    demandText = (
      <>
        <p>
          For <strong>{summary.label}</strong>, your property is currently <strong>{summary.occupancyPercent.toFixed(0)}%</strong> booked
          (<strong>{summary.bookedNights}</strong> of <strong>{summary.totalAvailableNights}</strong> available room-nights).
          {summary.revenueTarget && summary.revenueTarget > 0 ? (
            <> Your monthly revenue target is <strong>{fmtMoney(summary.revenueTarget)}</strong>, and you've earned <strong>{fmtMoney(summary.revenueTotal)}</strong> so far (<strong>{revPctOfTarget.toFixed(0)}%</strong> of target).</>
          ) : (
            <> No monthly revenue target is set, so revenue-based adjustments are off.</>
          )}
        </p>
        {paceLine}
      </>
    );
  }

  // Adjustments section
  let adjustmentsText: React.ReactNode = null;
  if (summary) {
    const dowMap = rules.day_of_week_multipliers || {};
    const weekendNames = weekendDays.map(d => FULL_DAY_NAMES[d]).join(' and ');
    const maxMult = Math.max(...Object.values(dowMap).map(Number));
    const weekdayParts = [0, 1, 2, 3, 4, 5, 6]
      .filter(d => !weekendDays.includes(d))
      .map(d => `${FULL_DAY_NAMES[d]} ×${Number(dowMap[String(d)] ?? 1).toFixed(2)}`)
      .join(', ');

    // Occupancy tier explanation
    let occTier = tierIndex(summary.occupancyPercent, occThresholds);
    const baseTier = occTier;
    let bumped = false;
    if (summary.phase === 'B' && summary.paceIndex != null && summary.paceIndex >= paceBumpThreshold) {
      if (occTier < occAdjustments.length - 1) { occTier += 1; bumped = true; }
    }
    const tierLabel = (i: number) => {
      const lo = i === 0 ? 0 : Number(occThresholds[i - 1]);
      const hi = i < occThresholds.length ? Number(occThresholds[i]) : 100;
      return `${lo}–${hi}%`;
    };
    const occAdj = Number(occAdjustments[occTier] ?? 0);

    // Revenue tier explanation
    let revLine: React.ReactNode = null;
    if (monthlyTarget > 0) {
      const revAchievement = (summary.revenueTotal / monthlyTarget) * 100;
      const revTier = tierIndex(revAchievement, revThresholds);
      const arr = summary.phase === 'B' ? revAdjB : revAdjA;
      let revAdj = Number(arr[revTier] ?? 0);
      let cappedNote: React.ReactNode = null;
      if (revAchievement > conflictRevMin && summary.occupancyPercent < conflictOccMax && revAdj > conflictCap) {
        revAdj = conflictCap;
        cappedNote = (
          <p className="mt-1">However, your high revenue achievement (<strong>{revAchievement.toFixed(0)}%</strong>) combined with low occupancy (<strong>{summary.occupancyPercent.toFixed(0)}%</strong>) triggered the conflict cap, limiting the revenue boost to <strong>+{conflictCap}%</strong> to avoid pricing too aggressively while inventory is still available.</p>
        );
      }
      revLine = (
        <>
          <p>You've earned <strong>{revAchievement.toFixed(0)}%</strong> of your monthly target so far (Phase {summary.phase}). The algorithm applies a <strong>{fmtPct(revAdj, true)}</strong> revenue adjustment based on this tier.</p>
          {cappedNote}
        </>
      );
    } else {
      revLine = <p>No monthly revenue target set — no revenue-based adjustment applies.</p>;
    }

    adjustmentsText = (
      <div className="space-y-3">
        <div>
          <p className="font-semibold">Day-of-Week</p>
          <p>Your weekend nights ({weekendNames || 'none configured'}) get up to a <strong>{maxMult.toFixed(2)}x</strong> premium because they have higher demand. Weekdays: {weekdayParts || 'none'}.</p>
        </div>
        <div>
          <p className="font-semibold">Occupancy</p>
          <p>
            Your current <strong>{summary.occupancyPercent.toFixed(0)}%</strong> occupancy {bumped
              ? <>combined with a strong Pace Index of <strong>{summary.paceIndex!.toFixed(2)}x</strong> bumps you up one tier from the {tierLabel(baseTier)} range to the {tierLabel(occTier)} range.</>
              : <>falls into the {tierLabel(occTier)} tier.</>} That's a <strong>{fmtPct(occAdj, true)}</strong> adjustment.
          </p>
        </div>
        <div>
          <p className="font-semibold">Revenue Target</p>
          {revLine}
        </div>
      </div>
    );
  }

  // Promotion section
  let promoSection: React.ReactNode = null;
  if (activePromotion) {
    const discountText = activePromotion.discount_type === 'percentage'
      ? `${activePromotion.discount_value}% off`
      : `$${activePromotion.discount_value} off per night`;
    promoSection = (
      <section>
        <h3 className="font-semibold text-base mb-2">Promotions Active</h3>
        <div className="space-y-1">
          <p><strong>Active Promotion: {activePromotion.name}</strong></p>
          <p>Discount: <strong>{discountText}</strong></p>
          <p>Bookable: {activePromotion.booking_window_start} – {activePromotion.booking_window_end}</p>
          <p>For stays: {activePromotion.stay_start} – {activePromotion.stay_end}</p>
          <p className="text-muted-foreground">This discount is applied AFTER the dynamic adjustments but BEFORE rate clamping.</p>
        </div>
      </section>
    );
  }

  // Overrides section
  let overridesSection: React.ReactNode = null;
  if (overrideCount > 0) {
    overridesSection = (
      <section>
        <h3 className="font-semibold text-base mb-2">Manual Overrides</h3>
        <p>You've set <strong>{overrideCount}</strong> manual override{overrideCount === 1 ? '' : 's'} this month. These take precedence over the algorithm — on those dates, your specified rate or adjustment is used directly, and the dynamic calculation is bypassed.</p>
      </section>
    );
  }

  // Bounds section
  let boundsSection: React.ReactNode = null;
  if (bounds) {
    const ceilCount = previewRows.filter(r => r.adjustments.was_clamped && r.adjustments.clamp_direction === 'ceiling').length;
    const floorCount = previewRows.filter(r => r.adjustments.was_clamped && r.adjustments.clamp_direction === 'floor').length;
    const total = previewRows.length || 1;
    let advisory: React.ReactNode = null;
    if (ceilCount / total > 0.5) {
      advisory = <p className="mt-1 text-muted-foreground">Note: many of your rates this month are hitting the ceiling. If you want the algorithm to capture more peak demand, consider raising the max rate.</p>;
    } else if (floorCount / total > 0.5) {
      advisory = <p className="mt-1 text-muted-foreground">Note: many of your rates this month are hitting the floor. If demand is genuinely soft, consider lowering the min rate to compete more aggressively.</p>;
    }
    boundsSection = (
      <section>
        <h3 className="font-semibold text-base mb-2">Rate Bounds</h3>
        <p>Your safety bounds for this room type:</p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li>Floor: <strong>{fmtMoney(bounds.min_rate)}</strong> (rates can never go below this)</li>
          <li>Ceiling: <strong>{fmtMoney(bounds.max_rate)}</strong> (rates can never exceed this)</li>
        </ul>
        {advisory}
      </section>
    );
  }

  // Worked example: pick highest final_rate weekend row, fallback to highest overall
  let exampleSection: React.ReactNode = null;
  if (previewRows.length > 0 && bounds) {
    const weekendRows = previewRows.filter(r => weekendDays.includes(new Date(r.target_date + 'T00:00:00Z').getUTCDay()));
    const pool = weekendRows.length > 0 ? weekendRows : previewRows;
    const example = pool.reduce((a, b) => (b.final_rate > a.final_rate ? b : a), pool[0]);
    const dow = new Date(example.target_date + 'T00:00:00Z').getUTCDay();
    const dayName = FULL_DAY_NAMES[dow];
    const isWeekendDay = weekendDays.includes(dow);
    const baseLabel = isWeekendDay ? 'weekend' : 'weekday';
    const mult = Number(example.adjustments.day_of_week_multiplier ?? 1);
    const occAdj = Number(example.adjustments.occupancy_adjustment ?? 0);
    const revAdj = Number(example.adjustments.revenue_adjustment ?? 0);
    const promoPct = example.adjustments.promotion_applied?.discount_percent ?? 0;
    const step1 = example.base_rate;
    const step2 = step1 * mult;
    const step3 = step2 * (1 + occAdj / 100);
    const step4 = step3 * (1 + revAdj / 100);
    const step5 = promoPct ? step4 * (1 - promoPct / 100) : step4;
    const clampNote = example.adjustments.was_clamped
      ? `Clamped to ${example.adjustments.clamp_direction}: ${fmtMoney(example.final_rate)}`
      : null;
    exampleSection = (
      <section>
        <h3 className="font-semibold text-base mb-2">Worked Example</h3>
        <p>Here's how <strong>{dayName}, {example.target_date}</strong> gets priced:</p>
        <ol className="list-decimal pl-5 space-y-1 mt-1">
          <li>Base rate: <strong>{fmtMoney(step1)}</strong> (the {baseLabel} rate from your Prices page)</li>
          <li>Day-of-week multiplier: ×{mult.toFixed(2)} = <strong>{fmtMoney(step2)}</strong></li>
          <li>Occupancy adjustment: {fmtPct(occAdj, true)} = <strong>{fmtMoney(step3)}</strong></li>
          <li>Revenue adjustment: {fmtPct(revAdj, true)} = <strong>{fmtMoney(step4)}</strong></li>
          {promoPct ? <li>Promotion discount: −{promoPct}% = <strong>{fmtMoney(step5)}</strong></li> : null}
          {clampNote ? <li>{clampNote}</li> : null}
        </ol>
        <p className="mt-2 text-base"><strong>Final rate: {fmtMoney(example.final_rate)}</strong></p>
      </section>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pricing Brief</DialogTitle>
          <DialogDescription>Plain-language summary of how the algorithm is pricing this month and room type.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Month</Label>
            <Select value={monthKey} onValueChange={setMonthKey}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthSummaries.map(s => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Room Type</Label>
            <Select value={ratePlanId} onValueChange={setRatePlanId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {activeRatePlans.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.room_type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto pr-2 text-sm text-foreground space-y-5 leading-relaxed">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading brief…</span>
            </div>
          ) : (
            <>
              <section>
                <h3 className="font-semibold text-base mb-2">Demand Snapshot</h3>
                {demandText}
              </section>
              <section>
                <h3 className="font-semibold text-base mb-2">How the Algorithm Adjusts</h3>
                {adjustmentsText}
              </section>
              {promoSection}
              {overridesSection}
              {boundsSection}
              {exampleSection}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Manual Overrides ----------
type OverrideType = 'fixed_rate' | 'percentage_adjustment' | 'multiplier';

interface OverrideDialogInitial {
  id?: string;
  override_date?: string;
  room_type?: string | null;
  override_type?: OverrideType;
  value?: number;
  reason?: string;
}

interface OverrideRow {
  id: string;
  property_id: string;
  override_date: string;
  override_type: OverrideType;
  value: number;
  reason: string | null;
  room_type: string | null;
  created_by: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<OverrideType, string> = {
  fixed_rate: 'Fixed Rate',
  percentage_adjustment: '% Adjustment',
  multiplier: 'Multiplier',
};

function formatOverrideValue(t: OverrideType, v: number): string {
  if (t === 'fixed_rate') return `$${Math.round(v).toLocaleString()}`;
  if (t === 'percentage_adjustment') return `${v >= 0 ? '+' : ''}${v}%`;
  return `${Number(v).toFixed(2)}x`;
}

function dateRangeList(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    const d = new Date(cur + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    cur = d.toISOString().slice(0, 10);
  }
  return out;
}

function OverrideDialog({
  open, onOpenChange, propertyId, roomTypes, initial, allowDateRange = true, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  propertyId: string;
  roomTypes: string[];
  initial?: OverrideDialogInitial;
  allowDateRange?: boolean;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const isEdit = !!initial?.id;
  const today = new Date().toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [roomType, setRoomType] = useState<string>('__all__');
  const [overrideType, setOverrideType] = useState<OverrideType>('fixed_rate');
  const [value, setValue] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStartDate(initial?.override_date ?? today);
    setEndDate(initial?.override_date ?? today);
    setRoomType(initial?.room_type ?? '__all__');
    setOverrideType((initial?.override_type as OverrideType) ?? 'fixed_rate');
    setValue(initial?.value != null ? String(initial.value) : '');
    setReason(initial?.reason ?? '');
  }, [open, initial, today]);

  const showRange = allowDateRange && !isEdit;

  async function handleSave() {
    const parsed = parseFloat(value);
    if (!isFinite(parsed)) {
      toast.error('Please enter a valid value');
      return;
    }
    if (!startDate) {
      toast.error('Please select a date');
      return;
    }
    setSaving(true);
    try {
      if (isEdit && initial?.id) {
        const { error } = await supabase
          .from('pricing_overrides')
          .update({ override_type: overrideType, value: parsed, reason: reason || null })
          .eq('id', initial.id);
        if (error) throw error;
        toast.success('Override updated');
      } else {
        const dates = showRange ? dateRangeList(startDate, endDate || startDate) : [startDate];
        const rt = roomType === '__all__' ? null : roomType;
        const rows = dates.map(d => ({
          property_id: propertyId,
          override_date: d,
          room_type: rt,
          override_type: overrideType,
          value: parsed,
          reason: reason || null,
          created_by: user?.id ?? null,
        }));
        const { error } = await supabase.from('pricing_overrides').insert(rows);
        if (error) {
          if ((error as any).code === '23505') {
            toast.error('An override already exists for this date and room type');
          } else {
            throw error;
          }
          return;
        }
        toast.success(rows.length === 1 ? `Override added for ${dates[0]}` : `Added ${rows.length} overrides`);
      }
      onSaved();
    } catch (err: any) {
      console.error('Failed to save override', err);
      toast.error(err?.message || 'Failed to save override');
    } finally {
      setSaving(false);
    }
  }

  const valueLabel =
    overrideType === 'fixed_rate' ? 'Set rate to exactly this amount' :
    overrideType === 'percentage_adjustment' ? 'Adjust calculated rate by this percentage (use negative for discount)' :
    'Multiply calculated rate by this factor';
  const valuePrefix = overrideType === 'fixed_rate' ? '$' : null;
  const valueSuffix = overrideType === 'percentage_adjustment' ? '%' : overrideType === 'multiplier' ? 'x' : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Override' : 'Add Override'}</DialogTitle>
          <DialogDescription>Manually set or adjust the rate for specific dates.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {showRange ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Start date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">End date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={isEdit} />
            </div>
          )}

          <div>
            <Label className="text-xs">Room Type</Label>
            <Select value={roomType} onValueChange={setRoomType} disabled={isEdit}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Room Types</SelectItem>
                {roomTypes.map(rt => (
                  <SelectItem key={rt} value={rt}>{rt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Override Type</Label>
            <RadioGroup
              value={overrideType}
              onValueChange={(v) => setOverrideType(v as OverrideType)}
              className="flex gap-4 pt-1"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="fixed_rate" id="ot-fixed" />
                <Label htmlFor="ot-fixed" className="text-sm font-normal">Fixed Rate</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="percentage_adjustment" id="ot-pct" />
                <Label htmlFor="ot-pct" className="text-sm font-normal">Percentage</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="multiplier" id="ot-mult" />
                <Label htmlFor="ot-mult" className="text-sm font-normal">Multiplier</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label className="text-xs">Value</Label>
            <div className="relative">
              {valuePrefix && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{valuePrefix}</span>
              )}
              <Input
                type="number"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={cn(valuePrefix && 'pl-7', valueSuffix && 'pr-7')}
              />
              {valueSuffix && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{valueSuffix}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{valueLabel}</p>
          </div>

          <div>
            <Label className="text-xs">Reason (optional)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you overriding? (e.g., local event, holiday)"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? 'Update' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OverridesSection({
  propertyId, refreshKey, onChanged,
}: {
  propertyId: string;
  refreshKey: number;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<OverrideRow[]>([]);
  const [roomTypes, setRoomTypes] = useState<string[]>([]);
  const [creators, setCreators] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OverrideDialogInitial | undefined>(undefined);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [overridesRes, unitsRes] = await Promise.all([
        supabase
          .from('pricing_overrides')
          .select('*')
          .eq('property_id', propertyId)
          .gte('override_date', today)
          .order('override_date', { ascending: true }),
        supabase
          .from('units')
          .select('booking_com_name')
          .eq('property_id', propertyId)
          .not('booking_com_name', 'is', null),
      ]);
      const fetched = ((overridesRes.data ?? []) as any[]).map(r => ({
        ...r,
        value: Number(r.value),
      })) as OverrideRow[];
      setRows(fetched);
      const distinct = Array.from(new Set(((unitsRes.data ?? []) as any[]).map(u => u.booking_com_name).filter(Boolean))) as string[];
      setRoomTypes(distinct.sort());

      const creatorIds = Array.from(new Set(fetched.map(r => r.created_by).filter((v): v is string => !!v)));
      if (creatorIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', creatorIds);
        const map: Record<string, string> = {};
        for (const p of (profs ?? []) as any[]) map[p.id] = p.full_name ?? '';
        setCreators(map);
      } else {
        setCreators({});
      }
    } catch (err) {
      console.error('Failed to load overrides', err);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  async function handleDelete(id: string) {
    const { error } = await supabase.from('pricing_overrides').delete().eq('id', id);
    if (error) {
      toast.error(error.message || 'Failed to delete override');
      return;
    }
    toast.success('Override removed');
    setConfirmDeleteId(null);
    await reload();
    onChanged();
  }

  function openAdd() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(r: OverrideRow) {
    setEditing({
      id: r.id,
      override_date: r.override_date,
      room_type: r.room_type,
      override_type: r.override_type,
      value: r.value,
      reason: r.reason ?? '',
    });
    setDialogOpen(true);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Manual Overrides</CardTitle>
          <CardDescription>Manually set or adjust rates for specific dates and room types.</CardDescription>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" /> Add Override
        </Button>
      </CardHeader>
      <CardContent>
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Room Type</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      No active overrides.
                    </TableCell>
                  </TableRow>
                ) : rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.override_date}</TableCell>
                    <TableCell>{r.room_type ?? 'All'}</TableCell>
                    <TableCell>{TYPE_LABELS[r.override_type]}</TableCell>
                    <TableCell>{formatOverrideValue(r.override_type, r.value)}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{r.reason ?? '—'}</TableCell>
                    <TableCell>{r.created_by ? (creators[r.created_by] || '—') : '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(r)} aria-label="Edit override">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setConfirmDeleteId(r.id)} aria-label="Delete override">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <OverrideDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        propertyId={propertyId}
        roomTypes={roomTypes}
        initial={editing}
        allowDateRange={!editing?.id}
        onSaved={() => {
          setDialogOpen(false);
          setEditing(undefined);
          reload();
          onChanged();
        }}
      />

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this override?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the manual override and the calculated rate will apply again.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

