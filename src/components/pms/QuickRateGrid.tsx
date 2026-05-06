import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, differenceInDays, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Trash2, Pencil, GripVertical, Check, CalendarIcon, Save, Lock, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useProperty } from '@/lib/propertyContext';
import { useAuth } from '@/lib/auth';

interface RatePlan {
  id: string;
  name: string;
  room_type: string | null;
  valid_from: string | null;
  valid_to: string | null;
  property_id: string | null;
}

interface RatePlanPrice {
  id: string;
  rate_plan_id: string;
  room_type: string;
  weekday_rate: number;
  weekend_rate: number;
  off_peak_rate: number | null;
  min_stay: number;
  unit_id: string | null;
  min_rate?: number | null;
  max_rate?: number | null;
}

interface PendingOverride {
  rate_plan_id: string;
  ratePlanName: string;
  room_type: string;
  override_date: string;
  oldRate: number;
  value: number;
  isWeekend: boolean;
}

interface DerivedChannel {
  channelName: string;
  markupPercentage: number;
  basePlanIds: Set<string>;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getCellColor = (currentRate: number, baseRate: number, isWeekend: boolean, isOffPeak: boolean): string => {
  if (baseRate === 0) {
    if (isOffPeak) return '#E3F2FD';
    return isWeekend ? 'hsl(0 70% 97%)' : '';
  }
  const pct = ((currentRate - baseRate) / baseRate) * 100;
  if (Math.abs(pct) < 1) {
    if (isOffPeak) return '#E3F2FD';
    return isWeekend ? 'hsl(0 70% 97%)' : '';
  }
  if (pct > 25) return '#A5D6A7';
  if (pct > 10) return '#C8E6C9';
  if (pct > 0) return '#E8F5E9';
  if (pct < -25) return '#FFCC80';
  if (pct < -10) return '#FFE0B2';
  if (pct < 0) return '#FFF3E0';
  return '';
};

const getVarianceArrow = (currentRate: number, baseRate: number): string => {
  if (baseRate === 0) return '';
  const pct = ((currentRate - baseRate) / baseRate) * 100;
  if (pct > 1) return '▲';
  if (pct < -1) return '▼';
  return '';
};

interface QuickRateGridProps {
  onSyncQueueCount?: (count: number) => void;
  readOnly?: boolean;
}

interface DragState {
  isDragging: boolean;
  planId: string | null;
  value: number | null;
  startColIdx: number;
  currentColIdx: number;
}

const cellKey = (planId: string, dateStr: string) => `${planId}:${dateStr}`;

export const QuickRateGrid = ({ onSyncQueueCount, readOnly = false }: QuickRateGridProps) => {
  const propertyId = usePropertyId();
  const { activeProperty } = useProperty();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const weekendDays = useMemo(() => (activeProperty as any)?.weekend_days ?? [4, 5], [activeProperty]);
  const offPeakDays = useMemo(() => (activeProperty as any)?.off_peak_days ?? [], [activeProperty]);
  const isWeekendRate = useCallback((date: Date) => weekendDays.includes(date.getDay()), [weekendDays]);
  const isOffPeakDay = useCallback((date: Date) => offPeakDays.includes(date.getDay()), [offPeakDays]);
  const isWeekendHighlight = useCallback((date: Date) => weekendDays.includes(date.getDay()), [weekendDays]);

  const [loading, setLoading] = useState(true);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [prices, setPrices] = useState<Record<string, RatePlanPrice>>({});

  // Engine-calculated rates: planId -> dateStr -> final_rate
  const [previewRates, setPreviewRates] = useState<Record<string, Record<string, number>>>({});
  const [previewLoading, setPreviewLoading] = useState(false);

  // pricing_overrides rows for this property in the visible window.
  // Marker-only: keyed by `${planId}:${date}` so we can show the badge
  // on every rate-plan row whose room_type matches an existing override.
  const [existingOverrideKeys, setExistingOverrideKeys] = useState<Set<string>>(new Set());

  // Two-stage queue:
  //   drafts        — typed but not yet applied  (amber border)
  //   pendingOverrides — applied, awaiting Save  (yellow bg + summary card)
  const [drafts, setDrafts] = useState<Map<string, number>>(new Map());
  const [pendingOverrides, setPendingOverrides] = useState<Map<string, PendingOverride>>(new Map());

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [filterRoomType, setFilterRoomType] = useState<string>('all');
  const [filterRatePlan, setFilterRatePlan] = useState<string>('all');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRate, setBulkRate] = useState('');
  const [bulkRoomType, setBulkRoomType] = useState('all');
  const [bulkRatePlan, setBulkRatePlan] = useState('all');
  const [bulkDateFrom, setBulkDateFrom] = useState<Date | undefined>();
  const [bulkDateTo, setBulkDateTo] = useState<Date | undefined>();
  const [lastCommittedCell, setLastCommittedCell] = useState<{ planId: string; colIdx: number; value: number } | null>(null);
  const [viewMode, setViewMode] = useState<'14days' | 'month'>('14days');
  const [derivedChannels, setDerivedChannels] = useState<DerivedChannel[]>([]);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [drag, setDrag] = useState<DragState>({ isDragging: false, planId: null, value: null, startColIdx: 0, currentColIdx: 0 });

  const days = useMemo(() => {
    if (viewMode === 'month') {
      const start = startOfMonth(weekStart);
      const end = endOfMonth(weekStart);
      return eachDayOfInterval({ start, end });
    }
    const numDays = isMobile ? 3 : 14;
    return Array.from({ length: numDays }, (_, i) => addDays(weekStart, i));
  }, [weekStart, isMobile, viewMode]);

  useEffect(() => {
    fetchData();
  }, [propertyId]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (drafts.size > 0 || pendingOverrides.size > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved rate changes';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [drafts.size, pendingOverrides.size]);

  // ── Existing pricing_overrides (for the Manual Override marker) ──
  const fetchExistingOverrides = useCallback(async () => {
    if (!propertyId || ratePlans.length === 0 || days.length === 0) return;
    const startDate = format(days[0], 'yyyy-MM-dd');
    const endDate = format(days[days.length - 1], 'yyyy-MM-dd');

    const { data, error } = await supabase
      .from('pricing_overrides')
      .select('override_date, room_type')
      .eq('property_id', propertyId)
      .gte('override_date', startDate)
      .lte('override_date', endDate);

    if (error) {
      console.error('fetch pricing_overrides error', error);
      return;
    }

    const keys = new Set<string>();
    (data || []).forEach((row: any) => {
      ratePlans.forEach(plan => {
        // Wildcard (room_type IS NULL) applies to every plan; specific room_type only matches its plan(s).
        if (row.room_type === null || row.room_type === plan.room_type) {
          keys.add(cellKey(plan.id, row.override_date));
        }
      });
    });
    setExistingOverrideKeys(keys);
  }, [propertyId, ratePlans, days]);

  useEffect(() => {
    fetchExistingOverrides();
  }, [fetchExistingOverrides]);

  // ── Engine preview rates ──
  const fetchPreviewRates = useCallback(async () => {
    if (!propertyId || ratePlans.length === 0 || days.length === 0) return;
    const startDate = format(days[0], 'yyyy-MM-dd');
    const endDate = format(days[days.length - 1], 'yyyy-MM-dd');

    // Only fetch for plans visible after filters (no point computing the rest)
    const visiblePlans = ratePlans.filter(p => {
      if (filterRoomType !== 'all' && p.room_type !== filterRoomType) return false;
      if (filterRatePlan !== 'all' && p.id !== filterRatePlan) return false;
      return p.room_type;
    });

    // Determine which (plan, date) combos are missing from cache
    const toFetch = visiblePlans.filter(plan => {
      const cached = previewRates[plan.id];
      if (!cached) return true;
      return days.some(d => cached[format(d, 'yyyy-MM-dd')] === undefined);
    });
    if (toFetch.length === 0) return;

    setPreviewLoading(true);
    try {
      const results = await Promise.all(
        toFetch.map(plan =>
          supabase.functions.invoke('calculate-dynamic-price-batch', {
            body: {
              property_id: propertyId,
              room_type: plan.room_type,
              rate_plan_id: plan.id,
              date_from: startDate,
              date_to: endDate,
            },
          }).then(res => ({ plan, res }))
        )
      );

      setPreviewRates(prev => {
        const next: Record<string, Record<string, number>> = { ...prev };
        results.forEach(({ plan, res }) => {
          const data = (res as any)?.data;
          if (!data?.success || !Array.isArray(data.rates)) return;
          const planMap = { ...(next[plan.id] || {}) };
          data.rates.forEach((r: any) => {
            if (r?.target_date && typeof r.final_rate === 'number') {
              planMap[r.target_date] = r.final_rate;
            }
          });
          next[plan.id] = planMap;
        });
        return next;
      });
    } catch (err) {
      console.error('preview fetch error', err);
    } finally {
      setPreviewLoading(false);
    }
  }, [propertyId, ratePlans, days, filterRoomType, filterRatePlan, previewRates]);

  useEffect(() => {
    fetchPreviewRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, ratePlans, weekStart, viewMode, filterRoomType, filterRatePlan]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, pricesRes, derivedRes] = await Promise.all([
        withPropertyFilter(
          supabase.from('rate_plans').select('id, name, room_type, valid_from, valid_to, property_id').eq('is_active', true).order('room_type').order('name'),
          propertyId
        ),
        supabase.from('rate_plan_prices').select('*').is('unit_id', null),
        withPropertyFilter(supabase.from('derived_rate_plan_mappings').select('id, base_rate_plan_id, channel_markup_id, channel_name, markup_percentage'), propertyId),
      ]);
      if (plansRes.error) throw plansRes.error;
      if (pricesRes.error) throw pricesRes.error;

      const plans = (plansRes.data || []).filter(p => p.room_type);
      setRatePlans(plans);

      const priceMap: Record<string, RatePlanPrice> = {};
      (pricesRes.data || []).forEach((p: any) => {
        priceMap[p.rate_plan_id] = p;
      });
      setPrices(priceMap);

      const channelMap = new Map<string, DerivedChannel>();
      ((derivedRes.data as any[]) || []).forEach((dm: any) => {
        const key = dm.channel_name;
        if (!channelMap.has(key)) {
          channelMap.set(key, {
            channelName: dm.channel_name,
            markupPercentage: Number(dm.markup_percentage),
            basePlanIds: new Set(),
          });
        }
        channelMap.get(key)!.basePlanIds.add(dm.base_rate_plan_id);
      });
      setDerivedChannels(Array.from(channelMap.values()));
    } catch (err) {
      console.error('Error fetching rate data:', err);
      toast.error('Failed to load rate data');
    } finally {
      setLoading(false);
    }
  };

  const roomTypes = useMemo(() => {
    const set = new Set(ratePlans.map(p => p.room_type).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [ratePlans]);

  const filteredPlans = useMemo(() => {
    return ratePlans.filter(p => {
      if (filterRoomType !== 'all' && p.room_type !== filterRoomType) return false;
      if (filterRatePlan !== 'all' && p.id !== filterRatePlan) return false;
      return true;
    });
  }, [ratePlans, filterRoomType, filterRatePlan]);

  const rows = useMemo(() => {
    return filteredPlans.map(plan => ({
      plan,
      price: prices[plan.id] || null,
    }));
  }, [filteredPlans, prices]);

  // Resolved rate that reflects what the engine WILL push to Channex once
  // drafts/pending are saved and synced.
  const getEffectiveRate = useCallback((price: RatePlanPrice | null, date: Date, planId: string): number => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const key = cellKey(planId, dateStr);
    const draft = drafts.get(key);
    if (draft !== undefined) return draft;
    const pending = pendingOverrides.get(key);
    if (pending) return pending.value;
    const preview = previewRates[planId]?.[dateStr];
    if (preview !== undefined) return preview;
    if (!price) return 0;
    if (isOffPeakDay(date) && price.off_peak_rate != null) return price.off_peak_rate;
    if (isWeekendRate(date)) return price.weekend_rate;
    return price.weekday_rate;
  }, [drafts, pendingOverrides, previewRates, isOffPeakDay, isWeekendRate]);

  // The "engine" value disregarding any pending/draft (used to detect no-op edits)
  const getEngineRate = useCallback((price: RatePlanPrice | null, date: Date, planId: string): number => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const preview = previewRates[planId]?.[dateStr];
    if (preview !== undefined) return preview;
    if (!price) return 0;
    if (isOffPeakDay(date) && price.off_peak_rate != null) return price.off_peak_rate;
    if (isWeekendRate(date)) return price.weekend_rate;
    return price.weekday_rate;
  }, [previewRates, isOffPeakDay, isWeekendRate]);

  const getBaseRate = (planId: string): number => {
    const price = prices[planId];
    return price ? price.weekday_rate : 0;
  };

  // Drag-fill: write into drafts (no equality short-circuit so user clearly sees the fill)
  useEffect(() => {
    const handleMouseUp = () => {
      if (!drag.isDragging || !drag.planId || drag.value === null) {
        setDrag({ isDragging: false, planId: null, value: null, startColIdx: 0, currentColIdx: 0 });
        return;
      }
      const planId = drag.planId;
      const plan = ratePlans.find(p => p.id === planId);
      if (!plan) {
        setDrag({ isDragging: false, planId: null, value: null, startColIdx: 0, currentColIdx: 0 });
        return;
      }
      const minCol = Math.min(drag.startColIdx, drag.currentColIdx);
      const maxCol = Math.max(drag.startColIdx, drag.currentColIdx);
      const price = prices[planId] || null;

      let count = 0;
      setDrafts(prev => {
        const next = new Map(prev);
        for (let i = minCol; i <= maxCol; i++) {
          const date = days[i];
          if (!date) continue;
          const dateStr = format(date, 'yyyy-MM-dd');
          const k = cellKey(planId, dateStr);
          const engine = getEngineRate(price, date, planId);
          if (drag.value === engine) {
            next.delete(k);
          } else {
            next.set(k, drag.value!);
          }
          count++;
        }
        return next;
      });
      if (count > 0) toast.success(`${count} cell(s) filled (draft)`);
      setDrag({ isDragging: false, planId: null, value: null, startColIdx: 0, currentColIdx: 0 });
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [drag, days, ratePlans, prices, getEngineRate]);

  const handleCellClick = (planId: string, date: Date, price: RatePlanPrice | null, colIdx: number, shiftKey?: boolean) => {
    if (shiftKey && lastCommittedCell && lastCommittedCell.planId === planId) {
      const minCol = Math.min(lastCommittedCell.colIdx, colIdx);
      const maxCol = Math.max(lastCommittedCell.colIdx, colIdx);
      const value = lastCommittedCell.value;
      setDrafts(prev => {
        const next = new Map(prev);
        for (let i = minCol; i <= maxCol; i++) {
          const d = days[i];
          if (!d) continue;
          const ds = format(d, 'yyyy-MM-dd');
          const k = cellKey(planId, ds);
          const engine = getEngineRate(price, d, planId);
          if (value === engine) next.delete(k);
          else next.set(k, value);
        }
        return next;
      });
      return;
    }

    const dateStr = format(date, 'yyyy-MM-dd');
    const key = cellKey(planId, dateStr);
    const rate = getEffectiveRate(price, date, planId);
    setActiveCell(key);
    setEditValue(rate > 0 ? String(rate) : '');
    setTimeout(() => inputRefs.current[key]?.select(), 0);
  };

  const commitCell = (key: string) => {
    if (!key || activeCell !== key) return;
    const [planId, dateStr] = key.split(':');
    const plan = ratePlans.find(p => p.id === planId);
    if (!plan) { setActiveCell(null); return; }
    if (editValue === '') {
      // empty input → discard this draft (revert to engine)
      setDrafts(prev => { const n = new Map(prev); n.delete(key); return n; });
      setActiveCell(null);
      return;
    }
    const newRate = parseFloat(editValue);
    if (isNaN(newRate) || newRate < 0) {
      setActiveCell(null);
      return;
    }
    const date = new Date(dateStr + 'T00:00:00');
    const colIdx = days.findIndex(d => format(d, 'yyyy-MM-dd') === dateStr);
    const engine = getEngineRate(prices[planId] || null, date, planId);

    setDrafts(prev => {
      const next = new Map(prev);
      if (newRate === engine) next.delete(key);
      else next.set(key, newRate);
      return next;
    });
    setLastCommittedCell({ planId, colIdx, value: newRate });
    setActiveCell(null);
  };

  const navigateCell = (currentKey: string, direction: 'right' | 'down' | 'left' | 'up') => {
    commitCell(currentKey);
    const [planId, dateStr] = currentKey.split(':');
    const rowIdx = rows.findIndex(r => r.plan.id === planId);
    const colIdx = days.findIndex(d => format(d, 'yyyy-MM-dd') === dateStr);
    if (rowIdx < 0 || colIdx < 0) return;

    let newRow = rowIdx;
    let newCol = colIdx;
    if (direction === 'right') newCol = Math.min(colIdx + 1, days.length - 1);
    if (direction === 'left') newCol = Math.max(colIdx - 1, 0);
    if (direction === 'down') newRow = Math.min(rowIdx + 1, rows.length - 1);
    if (direction === 'up') newRow = Math.max(rowIdx - 1, 0);

    const newPlan = rows[newRow];
    const newDate = days[newCol];
    if (newPlan && newDate) {
      handleCellClick(newPlan.plan.id, newDate, newPlan.price, newCol);
    }
  };

  const copyToNextCell = (currentKey: string, toEnd: boolean) => {
    commitCell(currentKey);
    const [planId, dateStr] = currentKey.split(':');
    const colIdx = days.findIndex(d => format(d, 'yyyy-MM-dd') === dateStr);
    const value = parseFloat(editValue);
    if (isNaN(value) || colIdx < 0) return;
    const endCol = toEnd ? days.length - 1 : Math.min(colIdx + 1, days.length - 1);
    const price = prices[planId] || null;
    let count = 0;
    setDrafts(prev => {
      const next = new Map(prev);
      for (let i = colIdx + 1; i <= endCol; i++) {
        const d = days[i];
        if (!d) continue;
        const ds = format(d, 'yyyy-MM-dd');
        const k = cellKey(planId, ds);
        const engine = getEngineRate(price, d, planId);
        if (value === engine) next.delete(k);
        else { next.set(k, value); count++; }
      }
      return next;
    });
    if (count > 0) toast.success(`Copied to ${count} cell(s) (draft)`);
  };

  // Apply Changes: validate drafts → move into pendingOverrides
  const applyDrafts = () => {
    if (drafts.size === 0) return;
    const newPending = new Map(pendingOverrides);
    let added = 0;
    let invalid = 0;
    drafts.forEach((value, key) => {
      const [planId, dateStr] = key.split(':');
      const plan = ratePlans.find(p => p.id === planId);
      const price = prices[planId];
      const room_type = plan?.room_type || price?.room_type || '';
      if (!plan || !room_type) { invalid++; return; }
      if (!isFinite(value) || value <= 0 || value > 100000) { invalid++; return; }
      const date = new Date(dateStr + 'T00:00:00');
      const oldRate = getEngineRate(price || null, date, planId);
      newPending.set(key, {
        rate_plan_id: planId,
        ratePlanName: plan.name,
        room_type,
        override_date: dateStr,
        oldRate,
        value,
        isWeekend: isWeekendRate(date),
      });
      added++;
    });
    if (invalid > 0) {
      toast.error(`${invalid} invalid value(s) — must be > 0 and ≤ 100000`);
      return;
    }
    setPendingOverrides(newPending);
    setDrafts(new Map());
    toast.success(`${added} override change(s) added to pending`);
  };

  const discardPending = () => {
    setPendingOverrides(new Map());
    toast.message('Pending overrides discarded');
  };

  const discardDrafts = () => {
    setDrafts(new Map());
  };

  // Save Changes: upsert pricing_overrides, then trigger channex-full-sync
  const saveChanges = async () => {
    if (pendingOverrides.size === 0) {
      toast.message('No changes to save');
      return;
    }
    if (!propertyId) {
      toast.error('No property selected');
      return;
    }

    setSaving(true);
    setSaveProgress(10);

    try {
      // Group by (override_date, room_type) — multiple plan rows for the same room_type+date collapse to one override
      const dedup = new Map<string, { override_date: string; room_type: string; value: number }>();
      pendingOverrides.forEach(p => {
        const k = `${p.override_date}::${p.room_type}`;
        dedup.set(k, { override_date: p.override_date, room_type: p.room_type, value: p.value });
      });

      const rows = Array.from(dedup.values()).map(r => ({
        property_id: propertyId,
        override_date: r.override_date,
        room_type: r.room_type,
        override_type: 'fixed_rate',
        value: r.value,
        reason: 'Inline calendar edit',
        created_by: user?.id ?? null,
      }));

      setSaveProgress(35);
      const { error: upsertError } = await supabase
        .from('pricing_overrides')
        .upsert(rows, { onConflict: 'property_id,override_date,room_type' });
      if (upsertError) throw upsertError;

      setSaveProgress(60);

      // Trigger full sync to push the new effective rates to Channex
      const { error: syncError } = await supabase.functions.invoke('channex-full-sync', {
        body: { propertyId },
      });

      setSaveProgress(90);

      // Refresh — clear preview cache so the next render pulls fresh engine values that include the new overrides
      setPreviewRates({});
      setPendingOverrides(new Map());
      await fetchExistingOverrides();

      setSaveProgress(100);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      setTimeout(() => setSaveProgress(0), 1500);

      if (syncError) {
        console.warn('channex-full-sync error', syncError);
        toast.warning('Overrides saved. Channex sync failed — please retry sync.');
      } else {
        toast.success(`${rows.length} manual override(s) saved and synced to Channex`);
      }
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error(err?.message || 'Failed to save overrides');
      setSaveProgress(0);
    } finally {
      setSaving(false);
    }
  };

  // Bulk Edit: writes drafts (NOT pricing_overrides directly)
  const applyBulkEdit = () => {
    const rate = parseFloat(bulkRate);
    if (isNaN(rate) || rate <= 0) {
      toast.error('Enter a valid positive rate');
      return;
    }
    if (!bulkDateFrom || !bulkDateTo) {
      toast.error('Select a date range');
      return;
    }
    const targetPlans = ratePlans.filter(p => {
      if (bulkRoomType !== 'all' && p.room_type !== bulkRoomType) return false;
      if (bulkRatePlan !== 'all' && p.id !== bulkRatePlan) return false;
      return true;
    });
    if (targetPlans.length === 0) {
      toast.error('No matching rate plans');
      return;
    }

    let count = 0;
    setDrafts(prev => {
      const next = new Map(prev);
      let current = new Date(bulkDateFrom);
      while (current <= bulkDateTo) {
        for (const plan of targetPlans) {
          const dateStr = format(current, 'yyyy-MM-dd');
          const k = cellKey(plan.id, dateStr);
          const engine = getEngineRate(prices[plan.id] || null, current, plan.id);
          if (rate === engine) {
            next.delete(k);
          } else {
            next.set(k, rate);
            count++;
          }
        }
        current = addDays(current, 1);
      }
      return next;
    });

    setBulkOpen(false);
    setBulkRate('');
    setBulkDateFrom(undefined);
    setBulkDateTo(undefined);
    toast.success(`${count} cell(s) drafted — review and click Apply Changes`);
  };

  const getDraggedColRange = (): [number, number] | null => {
    if (!drag.isDragging) return null;
    return [Math.min(drag.startColIdx, drag.currentColIdx), Math.max(drag.startColIdx, drag.currentColIdx)];
  };

  const isCellInDragRange = (planId: string, colIdx: number): boolean => {
    if (!drag.isDragging || drag.planId !== planId) return false;
    const range = getDraggedColRange();
    if (!range) return false;
    return colIdx >= range[0] && colIdx <= range[1];
  };

  const handleDragStart = (planId: string, colIdx: number, value: number) => {
    setDrag({ isDragging: true, planId, value, startColIdx: colIdx, currentColIdx: colIdx });
  };

  const handleDragEnter = (planId: string, colIdx: number) => {
    if (!drag.isDragging || drag.planId !== planId) return;
    setDrag(prev => ({ ...prev, currentColIdx: colIdx }));
  };

  const formatCurrency = (v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const handlePrev = () => {
    if (viewMode === 'month') setWeekStart(prev => subMonths(prev, 1));
    else setWeekStart(prev => addDays(prev, isMobile ? -3 : -14));
  };
  const handleNext = () => {
    if (viewMode === 'month') setWeekStart(prev => addMonths(prev, 1));
    else setWeekStart(prev => addDays(prev, isMobile ? 3 : 14));
  };
  const handleToday = () => {
    if (viewMode === 'month') setWeekStart(startOfMonth(new Date()));
    else setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  };

  const cellMinWidth = viewMode === 'month' ? 'min-w-[70px]' : 'min-w-[90px]';

  const groupedRows = useMemo(() => {
    const byRoomType = new Map<string, typeof rows>();
    const order: string[] = [];
    rows.forEach(row => {
      const rt = row.plan.room_type || 'Unknown';
      if (!byRoomType.has(rt)) { byRoomType.set(rt, []); order.push(rt); }
      byRoomType.get(rt)!.push(row);
    });
    return order.map(rt => ({ roomType: rt, plans: byRoomType.get(rt)! }));
  }, [rows]);

  const renderCombinedTable = () => {
    if (groupedRows.length === 0) {
      return <p className="text-center text-muted-foreground py-8 text-sm">No rate plans found.</p>;
    }
    return (
      <ScrollArea className="w-full">
        <table className="w-full border-collapse text-sm select-none">
          <thead>
            <tr>
              <th className="text-left p-2 border-b bg-muted/50 sticky left-0 z-10 min-w-[220px]" style={{ boxShadow: '2px 0 4px rgba(0,0,0,0.1)' }}>Room / Plan</th>
              {days.map((d) => (
                <th key={d.toISOString()} className={`text-center p-2 border-b ${cellMinWidth} ${isWeekendHighlight(d) ? 'bg-accent/30' : isOffPeakDay(d) ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-muted/50'}`}>
                  <div className="font-medium">{format(d, viewMode === 'month' ? 'd' : 'MMM d')}</div>
                  <div className="text-[10px] text-muted-foreground font-normal">{format(d, 'EEE')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupedRows.map(({ roomType, plans: groupPlans }) => (
              <React.Fragment key={roomType}>
                <tr className="bg-muted/30">
                  <td colSpan={days.length + 1} className="p-2 font-semibold text-sm border-b border-t">{roomType}</td>
                </tr>

                {groupPlans.map(({ plan, price }) => {
                  const baseRate = getBaseRate(plan.id);
                  const planChannels = derivedChannels.filter(ch => ch.basePlanIds.has(plan.id));
                  return (
                    <React.Fragment key={plan.id}>
                      <tr className="border-b hover:bg-muted/10">
                        <td className="p-2 pl-4 sticky left-0 bg-background z-10 border-r" style={{ boxShadow: '2px 0 4px rgba(0,0,0,0.1)' }}>
                          <div className="font-medium text-xs leading-tight">Standard Rate – {plan.room_type}</div>
                          <div className="text-[10px] text-muted-foreground">{plan.name}</div>
                        </td>
                        {days.map((d, colIdx) => {
                          const dateStr = format(d, 'yyyy-MM-dd');
                          const key = cellKey(plan.id, dateStr);
                          const rate = getEffectiveRate(price, d, plan.id);
                          const isDraft = drafts.has(key);
                          const isPending = !isDraft && pendingOverrides.has(key);
                          const isActive = activeCell === key;
                          const weekend = isWeekendHighlight(d);
                          const inDragRange = isCellInDragRange(plan.id, colIdx);
                          const offPeak = isOffPeakDay(d);
                          const hasOverrideMarker = existingOverrideKeys.has(key) || isDraft || isPending;
                          const varianceColor = !isPending && !isDraft && !inDragRange && rate > 0 ? getCellColor(rate, baseRate, weekend, offPeak) : '';
                          const arrow = !isPending && !isDraft && rate > 0 ? getVarianceArrow(rate, baseRate) : '';

                          // Clamp warning vs per-rate-plan bounds
                          const minR = price?.min_rate ?? null;
                          const maxR = price?.max_rate ?? null;
                          const willClamp = (isDraft || isPending) && rate > 0 && (
                            (minR != null && rate < Number(minR)) ||
                            (maxR != null && rate > Number(maxR))
                          );
                          const clampTarget = willClamp
                            ? (minR != null && rate < Number(minR) ? Number(minR) : Number(maxR))
                            : null;

                          return (
                            <td
                              key={key}
                              className={cn(
                                `text-center p-0.5 ${cellMinWidth} cursor-pointer relative`,
                                inDragRange && 'border-2 border-dashed border-primary/60 bg-primary/10',
                                !inDragRange && isDraft && 'border-2 border-amber-400 bg-amber-50 dark:bg-amber-900/20',
                                !inDragRange && !isDraft && isPending && 'bg-yellow-100 dark:bg-yellow-900/30',
                              )}
                              style={!inDragRange && !isPending && !isDraft && varianceColor ? { backgroundColor: varianceColor } : undefined}
                              onClick={(e) => !isActive && !drag.isDragging && handleCellClick(plan.id, d, price, colIdx, e.shiftKey)}
                              onMouseEnter={() => handleDragEnter(plan.id, colIdx)}
                            >
                              {isActive ? (
                                <input
                                  ref={el => { inputRefs.current[key] = el; }}
                                  type="number"
                                  className="w-full h-8 text-center text-sm border rounded bg-background focus:ring-2 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onBlur={() => commitCell(key)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') navigateCell(key, 'down');
                                    else if (e.key === 'Tab') { e.preventDefault(); navigateCell(key, e.shiftKey ? 'left' : 'right'); }
                                    else if (e.key === 'Escape') {
                                      setDrafts(prev => { const n = new Map(prev); n.delete(key); return n; });
                                      setActiveCell(null);
                                    }
                                    else if (e.key === 'ArrowDown') { e.preventDefault(); navigateCell(key, 'down'); }
                                    else if (e.key === 'ArrowUp') { e.preventDefault(); navigateCell(key, 'up'); }
                                    else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') { e.preventDefault(); copyToNextCell(key, e.shiftKey); }
                                    else if (e.key === 'ArrowRight' && (e.target as HTMLInputElement).selectionStart === editValue.length) { e.preventDefault(); navigateCell(key, 'right'); }
                                    else if (e.key === 'ArrowLeft' && (e.target as HTMLInputElement).selectionStart === 0) { e.preventDefault(); navigateCell(key, 'left'); }
                                  }}
                                  autoFocus
                                />
                              ) : (
                                <div className="h-8 flex items-center justify-center text-sm font-mono group relative">
                                  <span>
                                    {inDragRange && drag.value !== null ? formatCurrency(drag.value) : rate > 0 ? formatCurrency(rate) : '—'}
                                    {arrow && <span className={`ml-0.5 text-[10px] ${arrow === '▲' ? 'text-green-600' : 'text-orange-600'}`}>{arrow}</span>}
                                  </span>

                                  {hasOverrideMarker && rate > 0 && (
                                    <span className="absolute top-0 right-0.5 leading-none">
                                      <Lock className="h-2.5 w-2.5 text-purple-600 dark:text-purple-400" />
                                    </span>
                                  )}

                                  {willClamp && clampTarget != null && (
                                    <TooltipProvider delayDuration={150}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="absolute bottom-0 right-0 leading-none">
                                            <AlertTriangle className="h-2.5 w-2.5 text-orange-500" />
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          This value will be clamped to {formatCurrency(clampTarget)}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}

                                  {rate > 0 && !drag.isDragging && (
                                    <div
                                      className="absolute right-0 top-0 bottom-0 w-4 flex items-center justify-center opacity-0 group-hover:opacity-60 hover:!opacity-100 cursor-grab"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDragStart(plan.id, colIdx, rate);
                                      }}
                                    >
                                      <GripVertical className="h-3 w-3 text-muted-foreground rotate-90" />
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      {/* OTA derived rate rows — read-only, computed from the resolved base value */}
                      {planChannels.map(channel => (
                        <tr key={`${plan.id}-${channel.channelName}`} className="border-b">
                          <td className="p-2 pl-4 sticky left-0 bg-background z-10 border-r" style={{ boxShadow: '2px 0 4px rgba(0,0,0,0.1)' }}>
                            <div className="text-xs text-muted-foreground leading-tight">{channel.channelName} Rate</div>
                            <div className="text-[10px] text-muted-foreground/70">Standard Rate + {channel.markupPercentage}% markup</div>
                          </td>
                          {days.map((d) => {
                            const directRate = getEffectiveRate(price, d, plan.id);
                            const otaRate = directRate > 0 ? Math.round(directRate * (1 + channel.markupPercentage / 100) * 100) / 100 : 0;
                            const weekend = isWeekendHighlight(d);
                            const offPeak = isOffPeakDay(d);
                            const otaBaseRate = baseRate > 0 ? Math.round(baseRate * (1 + channel.markupPercentage / 100)) : 0;
                            const varianceColor = otaRate > 0 ? getCellColor(otaRate, otaBaseRate, weekend, offPeak) : '';
                            return (
                              <td
                                key={d.toISOString()}
                                className={cn(`text-center p-0.5 ${cellMinWidth} cursor-default`)}
                                style={varianceColor ? { backgroundColor: varianceColor } : undefined}
                              >
                                <div className="h-8 flex items-center justify-center text-sm font-mono text-muted-foreground">
                                  {otaRate > 0 ? formatCurrency(otaRate) : '—'}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground">Loading rates...</div>;
  }

  const pendingExamples = Array.from(pendingOverrides.values()).slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterRoomType} onValueChange={setFilterRoomType}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Room Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Room Types</SelectItem>
            {roomTypes.map(rt => <SelectItem key={rt} value={rt}>{rt}</SelectItem>)}
          </SelectContent>
        </Select>

        {!readOnly && (
          <Select value={filterRatePlan} onValueChange={setFilterRatePlan}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Rate Plan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rate Plans</SelectItem>
              {ratePlans.map(rp => <SelectItem key={rp.id} value={rp.id}>{rp.room_type} / {rp.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)} className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          Bulk Edit
        </Button>

        {previewLoading && (
          <Badge variant="outline" className="gap-1 text-[11px]">Loading engine rates…</Badge>
        )}

        <div className="ml-auto flex items-center gap-2">
          {saveSuccess && (
            <Badge className="gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200">
              <Check className="h-3 w-3" />
              Synced
            </Badge>
          )}
          {drafts.size > 0 && (
            <Badge variant="outline" className="gap-1 text-amber-700 border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300">
              {drafts.size} draft
            </Badge>
          )}
          {drafts.size > 0 && (
            <Button size="sm" onClick={applyDrafts} variant="outline" className="gap-1.5 border-amber-400 text-amber-700 hover:bg-amber-50">
              Apply Changes
            </Button>
          )}
          {pendingOverrides.size > 0 && (
            <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300">
              {pendingOverrides.size} pending
            </Badge>
          )}
          <Button
            size="sm"
            onClick={saveChanges}
            disabled={saving || pendingOverrides.size === 0}
            className="gap-1.5 bg-foreground text-background hover:bg-foreground/90"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving...' : `Save Changes${pendingOverrides.size > 0 ? ` (${pendingOverrides.size})` : ''}`}
          </Button>
        </div>
      </div>

      {(saving || saveProgress > 0) && (
        <Progress value={saveProgress} className="h-2 [&>div]:bg-foreground" />
      )}

      {/* Date nav + view toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="icon" onClick={handlePrev}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-medium">
          {viewMode === 'month'
            ? format(startOfMonth(weekStart), 'MMMM yyyy')
            : `${format(days[0], 'MMM d')} – ${format(days[days.length - 1], 'MMM d, yyyy')}`}
        </span>
        <Button variant="ghost" size="icon" onClick={handleNext}><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" className="text-xs" onClick={handleToday}>
          {viewMode === 'month' ? 'This Month' : 'Today'}
        </Button>
        <div className="ml-auto flex items-center gap-1 border rounded-md p-0.5">
          <Button variant={viewMode === '14days' ? 'default' : 'ghost'} size="sm" className="text-xs h-7 px-3" onClick={() => setViewMode('14days')}>14 Days</Button>
          <Button variant={viewMode === 'month' ? 'default' : 'ghost'} size="sm" className="text-xs h-7 px-3" onClick={() => { setViewMode('month'); setWeekStart(startOfMonth(weekStart)); }}>Month</Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#C8E6C9' }} /><span>Above base rate</span></div>
        <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#FFE0B2' }} /><span>Below base rate</span></div>
        <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'hsl(0 70% 97%)' }} /><span>Weekend ({weekendDays.map(d => DAY_NAMES[d]).join('–')})</span></div>
        {offPeakDays.length > 0 && (
          <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#E3F2FD' }} /><span>Off-Peak ({offPeakDays.map(d => DAY_NAMES[d]).join('–')})</span></div>
        )}
        <div className="flex items-center gap-1.5">
          <Lock className="h-3 w-3 text-purple-600 dark:text-purple-400" />
          <span>Manual Override</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm border-2 border-amber-400 bg-amber-50" />
          <span>Draft</span>
        </div>
      </div>

      {/* Calendar */}
      {renderCombinedTable()}

      {/* Drafts panel */}
      {drafts.size > 0 && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{drafts.size} unapplied draft(s)</span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={discardDrafts}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Discard Drafts
                </Button>
                <Button size="sm" onClick={applyDrafts} variant="outline" className="border-amber-400 text-amber-700 hover:bg-amber-50">
                  Apply Changes
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending overrides panel */}
      {pendingOverrides.size > 0 && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{pendingOverrides.size} manual override(s) ready to save</span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={discardPending}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Discard
                </Button>
                <Button size="sm" onClick={saveChanges} disabled={saving} className="gap-1 bg-foreground text-background hover:bg-foreground/90">
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {pendingExamples.map((c, i) => (
                <div key={i} className="text-xs text-muted-foreground">
                  • {c.room_type} / {c.ratePlanName} / {format(new Date(c.override_date + 'T00:00:00'), 'MMM d')}: {formatCurrency(c.oldRate)} → <span className="text-foreground font-medium">{formatCurrency(c.value)}</span>
                </div>
              ))}
              {pendingOverrides.size > pendingExamples.length && (
                <div className="text-xs text-muted-foreground italic">… and {pendingOverrides.size - pendingExamples.length} more</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Rate Edit</DialogTitle>
            <DialogDescription>
              Apply a rate to a specific date range. Changes are queued as drafts — review and click Apply, then Save.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="space-y-2 flex-1">
                <Label>From</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !bulkDateFrom && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {bulkDateFrom ? format(bulkDateFrom, 'MMM d, yyyy') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={bulkDateFrom} onSelect={setBulkDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2 flex-1">
                <Label>To</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !bulkDateTo && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {bulkDateTo ? format(bulkDateTo, 'MMM d, yyyy') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={bulkDateTo} onSelect={setBulkDateTo} disabled={(date) => bulkDateFrom ? date < bulkDateFrom : false} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Room Type</Label>
              <Select value={bulkRoomType} onValueChange={setBulkRoomType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Room Types</SelectItem>
                  {roomTypes.map(rt => <SelectItem key={rt} value={rt}>{rt}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rate Plan</Label>
              <Select value={bulkRatePlan} onValueChange={setBulkRatePlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rate Plans</SelectItem>
                  {ratePlans.filter(rp => bulkRoomType === 'all' || rp.room_type === bulkRoomType).map(rp => (
                    <SelectItem key={rp.id} value={rp.id}>{rp.room_type} / {rp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>New Rate ($ per night)</Label>
              <Input type="number" value={bulkRate} onChange={e => setBulkRate(e.target.value)} placeholder="e.g. 150" />
            </div>
            {bulkDateFrom && bulkDateTo && (
              <p className="text-xs text-muted-foreground">
                {differenceInDays(bulkDateTo, bulkDateFrom) + 1} date(s) × {ratePlans.filter(p => (bulkRoomType === 'all' || p.room_type === bulkRoomType) && (bulkRatePlan === 'all' || p.id === bulkRatePlan)).length} rate plan(s)
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button onClick={applyBulkEdit} disabled={!bulkDateFrom || !bulkDateTo || !bulkRate}>Add to Drafts</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
