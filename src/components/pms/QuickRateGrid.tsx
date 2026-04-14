import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, differenceInDays, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Send, Trash2, Pencil, GripVertical, Check, CalendarIcon, Save } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useProperty } from '@/lib/propertyContext';

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
}

interface PendingChange {
  ratePlanId: string;
  ratePlanName: string;
  roomType: string;
  date: string;
  oldRate: number;
  newRate: number;
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
}

interface DragState {
  isDragging: boolean;
  planId: string | null;
  value: number | null;
  startColIdx: number;
  currentColIdx: number;
}

export const QuickRateGrid = ({ onSyncQueueCount }: QuickRateGridProps) => {
  const propertyId = usePropertyId();
  const { activeProperty } = useProperty();
  const isMobile = useIsMobile();

  const weekendDays = useMemo(() => (activeProperty as any)?.weekend_days ?? [4, 5], [activeProperty]);
  const offPeakDays = useMemo(() => (activeProperty as any)?.off_peak_days ?? [], [activeProperty]);
  const isWeekendRate = useCallback((date: Date) => weekendDays.includes(date.getDay()), [weekendDays]);
  const isOffPeakDay = useCallback((date: Date) => offPeakDays.includes(date.getDay()), [offPeakDays]);
  const isWeekendHighlight = useCallback((date: Date) => weekendDays.includes(date.getDay()), [weekendDays]);

  const [loading, setLoading] = useState(true);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [prices, setPrices] = useState<Record<string, RatePlanPrice>>({});
  const [dateOverrides, setDateOverrides] = useState<Record<string, number>>({});
  const [overrideSources, setOverrideSources] = useState<Set<string>>(new Set()); // keys that have any override
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
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
      if (pendingChanges.size > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved rate changes';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pendingChanges.size]);

  useEffect(() => {
    if (ratePlans.length > 0) {
      fetchDateOverrides();
    }
  }, [weekStart, viewMode, ratePlans]);

  const fetchDateOverrides = async () => {
    try {
      const visibleDays = viewMode === 'month'
        ? eachDayOfInterval({ start: startOfMonth(weekStart), end: endOfMonth(weekStart) })
        : Array.from({ length: isMobile ? 3 : 14 }, (_, i) => addDays(weekStart, i));
      const startDate = format(visibleDays[0], 'yyyy-MM-dd');
      const endDate = format(visibleDays[visibleDays.length - 1], 'yyyy-MM-dd');
      const planIds = ratePlans.map(p => p.id);
      if (planIds.length === 0) return;

      // Fetch from rate_plan_date_overrides (higher priority)
      const { data: dateOverrideData, error: doError } = await supabase
        .from('rate_plan_date_overrides')
        .select('rate_plan_id, override_date, rate')
        .in('rate_plan_id', planIds)
        .gte('override_date', startDate)
        .lte('override_date', endDate);

      if (doError) throw doError;

      // Fetch from rate_plan_restrictions where rate IS NOT NULL
      const { data: restrictionData, error: rError } = await supabase
        .from('rate_plan_restrictions')
        .select('rate_plan_id, date_from, date_to, rate')
        .in('rate_plan_id', planIds)
        .not('rate', 'is', null)
        .lte('date_from', endDate)
        .gte('date_to', startDate);

      if (rError) throw rError;

      const overrideMap: Record<string, number> = {};
      const sourceSet = new Set<string>();

      // First, expand restriction date ranges (lower priority)
      (restrictionData || []).forEach(row => {
        const from = new Date(row.date_from + 'T00:00:00');
        const to = new Date(row.date_to + 'T00:00:00');
        const visStart = new Date(startDate + 'T00:00:00');
        const visEnd = new Date(endDate + 'T00:00:00');
        const effectiveFrom = from < visStart ? visStart : from;
        const effectiveTo = to > visEnd ? visEnd : to;

        let current = new Date(effectiveFrom);
        while (current <= effectiveTo) {
          const ds = format(current, 'yyyy-MM-dd');
          const key = `${row.rate_plan_id}:${ds}`;
          overrideMap[key] = Number(row.rate) / 100;
          sourceSet.add(key);
          current = addDays(current, 1);
        }
      });

      // Then, overlay date_overrides (higher priority — overwrites restriction rates)
      (dateOverrideData || []).forEach(row => {
        const key = `${row.rate_plan_id}:${row.override_date}`;
        overrideMap[key] = Number(row.rate);
        sourceSet.add(key);
      });

      setDateOverrides(overrideMap);
      setOverrideSources(sourceSet);
    } catch (err) {
      console.error('Error fetching date overrides:', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, pricesRes, markupsRes, derivedRes] = await Promise.all([
        withPropertyFilter(
          supabase.from('rate_plans').select('id, name, room_type, valid_from, valid_to, property_id').eq('is_active', true).order('room_type').order('name'),
          propertyId
        ),
        supabase.from('rate_plan_prices').select('*').is('unit_id', null),
        withPropertyFilter(supabase.from('channel_markup_settings').select('id, channel_name, markup_percentage').eq('is_active', true), propertyId),
        withPropertyFilter(supabase.from('derived_rate_plan_mappings').select('id, base_rate_plan_id, channel_markup_id, channel_name, markup_percentage'), propertyId),
      ]);
      if (plansRes.error) throw plansRes.error;
      if (pricesRes.error) throw pricesRes.error;

      const plans = (plansRes.data || []).filter(p => p.room_type);
      setRatePlans(plans);

      const priceMap: Record<string, RatePlanPrice> = {};
      (pricesRes.data || []).forEach(p => {
        priceMap[p.rate_plan_id] = p;
      });
      setPrices(priceMap);

      // Build derived channels from actual DB data
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

  const getCellKey = (planId: string, dateStr: string) => `${planId}:${dateStr}`;

  const getEffectiveRate = (price: RatePlanPrice | null, date: Date, planId: string): number => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const key = getCellKey(planId, dateStr);
    const pending = pendingChanges.get(key);
    if (pending) return pending.newRate;
    const override = dateOverrides[key];
    if (override !== undefined) return override;
    if (!price) return 0;
    if (isOffPeakDay(date) && price.off_peak_rate != null) return price.off_peak_rate;
    if (isWeekendRate(date)) return price.weekend_rate;
    return price.weekday_rate;
  };

  const getBaseRate = (planId: string): number => {
    const price = prices[planId];
    return price ? price.weekday_rate : 0;
  };

  // Global mouseup for drag-to-fill
  useEffect(() => {
    const handleMouseUp = () => {
      if (!drag.isDragging || !drag.planId || drag.value === null) {
        setDrag({ isDragging: false, planId: null, value: null, startColIdx: 0, currentColIdx: 0 });
        return;
      }

      const plan = ratePlans.find(p => p.id === drag.planId);
      if (!plan) {
        setDrag({ isDragging: false, planId: null, value: null, startColIdx: 0, currentColIdx: 0 });
        return;
      }

      const price = prices[drag.planId];
      const minCol = Math.min(drag.startColIdx, drag.currentColIdx);
      const maxCol = Math.max(drag.startColIdx, drag.currentColIdx);

      const newPending = new Map(pendingChanges);
      let count = 0;

      for (let i = minCol; i <= maxCol; i++) {
        const date = days[i];
        if (!date) continue;
        const dateStr = format(date, 'yyyy-MM-dd');
        const key = getCellKey(drag.planId, dateStr);
        const weekend = isWeekendRate(date);
        const oldRate = price ? (weekend ? price.weekend_rate : price.weekday_rate) : 0;

        if (drag.value !== oldRate) {
          newPending.set(key, {
            ratePlanId: drag.planId,
            ratePlanName: plan.name,
            roomType: plan.room_type || '',
            date: dateStr,
            oldRate,
            newRate: drag.value,
            isWeekend: weekend,
          });
          count++;
        }
      }

      if (count > 0) {
        setPendingChanges(newPending);
        toast.success(`${count} cell(s) filled`);
      }

      setDrag({ isDragging: false, planId: null, value: null, startColIdx: 0, currentColIdx: 0 });
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [drag, days, ratePlans, prices, pendingChanges]);

  const handleCellClick = (planId: string, date: Date, price: RatePlanPrice | null, colIdx: number, shiftKey?: boolean) => {
    if (shiftKey && lastCommittedCell && lastCommittedCell.planId === planId) {
      const plan = ratePlans.find(p => p.id === planId);
      if (!plan) return;

      const priceData = prices[planId];
      const minCol = Math.min(lastCommittedCell.colIdx, colIdx);
      const maxCol = Math.max(lastCommittedCell.colIdx, colIdx);
      const newPending = new Map(pendingChanges);
      let count = 0;

      for (let i = minCol; i <= maxCol; i++) {
        const d = days[i];
        if (!d) continue;
        const dateStr = format(d, 'yyyy-MM-dd');
        const key = getCellKey(planId, dateStr);
        const weekend = isWeekendRate(d);
        const oldRate = priceData ? (weekend ? priceData.weekend_rate : priceData.weekday_rate) : 0;

        if (lastCommittedCell.value !== oldRate) {
          newPending.set(key, {
            ratePlanId: planId,
            ratePlanName: plan.name,
            roomType: plan.room_type || '',
            date: dateStr,
            oldRate,
            newRate: lastCommittedCell.value,
            isWeekend: weekend,
          });
          count++;
        }
      }

      if (count > 0) {
        setPendingChanges(newPending);
        toast.success(`${count} cell(s) filled`);
      }
      return;
    }

    const dateStr = format(date, 'yyyy-MM-dd');
    const key = getCellKey(planId, dateStr);
    const rate = getEffectiveRate(price, date, planId);
    setActiveCell(key);
    setEditValue(rate > 0 ? String(rate) : '');
    setTimeout(() => inputRefs.current[key]?.select(), 0);
  };

  const commitCell = (key: string) => {
    if (!key || activeCell !== key) return;
    const [planId, dateStr] = key.split(':');
    const plan = ratePlans.find(p => p.id === planId);
    const price = prices[planId];
    if (!plan) return;

    const newRate = parseFloat(editValue);
    if (isNaN(newRate) || newRate < 0) {
      setActiveCell(null);
      return;
    }

    const date = new Date(dateStr + 'T00:00:00');
    const weekend = isWeekendRate(date);
    const overrideKey = getCellKey(planId, dateStr);
    const override = dateOverrides[overrideKey];
    const oldRate = override !== undefined ? override : (price ? (weekend ? price.weekend_rate : price.weekday_rate) : 0);
    const colIdx = days.findIndex(d => format(d, 'yyyy-MM-dd') === dateStr);

    if (newRate === oldRate) {
      setPendingChanges(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    } else {
      setPendingChanges(prev => {
        const next = new Map(prev);
        next.set(key, {
          ratePlanId: planId,
          ratePlanName: plan.name,
          roomType: plan.room_type || '',
          date: dateStr,
          oldRate,
          newRate,
          isWeekend: weekend,
        });
        return next;
      });
    }

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
    const plan = ratePlans.find(p => p.id === planId);
    const priceData = prices[planId];
    if (!plan) return;

    const colIdx = days.findIndex(d => format(d, 'yyyy-MM-dd') === dateStr);
    const value = parseFloat(editValue);
    if (isNaN(value) || colIdx < 0) return;

    const newPending = new Map(pendingChanges);
    const endCol = toEnd ? days.length - 1 : Math.min(colIdx + 1, days.length - 1);
    let count = 0;

    for (let i = colIdx + 1; i <= endCol; i++) {
      const d = days[i];
      if (!d) continue;
      const ds = format(d, 'yyyy-MM-dd');
      const key = getCellKey(planId, ds);
      const weekend = isWeekendRate(d);
      const oldRate = priceData ? (weekend ? priceData.weekend_rate : priceData.weekday_rate) : 0;

      if (value !== oldRate) {
        newPending.set(key, {
          ratePlanId: planId,
          ratePlanName: plan.name,
          roomType: plan.room_type || '',
          date: ds,
          oldRate,
          newRate: value,
          isWeekend: weekend,
        });
        count++;
      }
    }

    if (count > 0) {
      setPendingChanges(newPending);
      toast.success(`Copied to ${count} cell(s)`);
    }
  };

  const syncNow = async () => {
    if (pendingChanges.size === 0 || syncing) return;
    setSyncing(true);
    setSyncProgress(10);

    try {
      const byPlan = new Map<string, PendingChange[]>();
      pendingChanges.forEach(change => {
        const list = byPlan.get(change.ratePlanId) || [];
        list.push(change);
        byPlan.set(change.ratePlanId, list);
      });

      setSyncProgress(30);
      const overrideRows = Array.from(pendingChanges.values()).map(change => ({
        rate_plan_id: change.ratePlanId,
        override_date: change.date,
        rate: change.newRate,
        updated_at: new Date().toISOString(),
      }));

      if (overrideRows.length > 0) {
        const { error: upsertError } = await supabase
          .from('rate_plan_date_overrides')
          .upsert(overrideRows, { onConflict: 'rate_plan_id,override_date' });
        if (upsertError) throw upsertError;
      }

      setSyncProgress(50);

      const updates = Array.from(pendingChanges.values()).map(change => ({
        property_id: propertyId,
        rate_plan_id: change.ratePlanId,
        date_from: change.date,
        date_to: change.date,
        rate: change.newRate,
      }));

      const { error: syncError } = await supabase.functions.invoke('channex-sync-rates', {
        body: { updates, propertyId },
      });
      if (syncError) {
        console.warn('Channex sync failed (rates saved locally):', syncError);
        toast.warning('Rates saved but Channex sync failed');
      }

      setSyncProgress(80);

      setDateOverrides(prev => {
        const updated = { ...prev };
        pendingChanges.forEach(change => {
          updated[`${change.ratePlanId}:${change.date}`] = change.newRate;
        });
        return updated;
      });

      setOverrideSources(prev => {
        const next = new Set(prev);
        pendingChanges.forEach(change => {
          next.add(`${change.ratePlanId}:${change.date}`);
        });
        return next;
      });

      const changeCount = pendingChanges.size;
      setPendingChanges(new Map());

      setSyncProgress(100);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
      setTimeout(() => setSyncProgress(0), 1500);
      toast.success(`${changeCount} rate change(s) saved & synced`);
    } catch (err) {
      console.error('Sync error:', err);
      toast.error('Failed to save rate changes');
      setSyncProgress(0);
    } finally {
      setSyncing(false);
    }
  };

  const applyBulkEdit = () => {
    const rate = parseFloat(bulkRate);
    if (isNaN(rate) || rate < 0) {
      toast.error('Enter a valid rate');
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

    const newPending = new Map(pendingChanges);
    let count = 0;

    let current = new Date(bulkDateFrom);
    while (current <= bulkDateTo) {
      for (const plan of targetPlans) {
        const price = prices[plan.id];
        const dateStr = format(current, 'yyyy-MM-dd');
        const key = getCellKey(plan.id, dateStr);
        const weekend = isWeekendRate(current);
        const oldRate = price ? (weekend ? price.weekend_rate : price.weekday_rate) : 0;

        if (rate !== oldRate) {
          newPending.set(key, {
            ratePlanId: plan.id,
            ratePlanName: plan.name,
            roomType: plan.room_type || '',
            date: dateStr,
            oldRate,
            newRate: rate,
            isWeekend: weekend,
          });
          count++;
        }
      }
      current = addDays(current, 1);
    }

    setPendingChanges(newPending);
    setBulkOpen(false);
    setBulkRate('');
    setBulkDateFrom(undefined);
    setBulkDateTo(undefined);
    toast.success(`${count} cell(s) updated`);
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

  const formatCurrency = (v: number) => `$${v.toLocaleString()}`;

  const handlePrev = () => {
    if (viewMode === 'month') {
      setWeekStart(prev => subMonths(prev, 1));
    } else {
      setWeekStart(prev => addDays(prev, isMobile ? -3 : -14));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setWeekStart(prev => addMonths(prev, 1));
    } else {
      setWeekStart(prev => addDays(prev, isMobile ? 3 : 14));
    }
  };

  const handleToday = () => {
    if (viewMode === 'month') {
      setWeekStart(startOfMonth(new Date()));
    } else {
      setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
    }
  };

  const cellMinWidth = viewMode === 'month' ? 'min-w-[70px]' : 'min-w-[90px]';

  // Render a calendar grid section (reused for Direct + OTA)
  const renderCalendarGrid = (
    gridRows: typeof rows,
    options: {
      editable: boolean;
      markupPct?: number;
      headerLabel: string;
      headerSubtitle?: string;
      headerClassName?: string;
    }
  ) => {
    const { editable, markupPct, headerLabel, headerSubtitle, headerClassName } = options;
    const applyMarkup = (rate: number) => markupPct ? Math.round(rate * (1 + markupPct / 100)) : rate;

    return (
      <div className="space-y-2">
        <div className={cn("px-3 py-2 rounded-md", headerClassName || "bg-muted/50")}>
          <h3 className="text-sm font-semibold">{headerLabel}</h3>
          {headerSubtitle && <p className="text-[11px] text-muted-foreground">{headerSubtitle}</p>}
        </div>

        {gridRows.length === 0 ? (
          <p className="text-center text-muted-foreground py-4 text-sm">No rate plans found.</p>
        ) : (
          <ScrollArea className="w-full">
            <table className="w-full border-collapse text-sm select-none">
              <thead>
                <tr>
                  <th className="text-left p-2 border-b bg-muted/50 sticky left-0 z-10 min-w-[160px]" style={{ boxShadow: '2px 0 4px rgba(0,0,0,0.1)' }}>Room / Plan</th>
                  {days.map((d) => (
                    <th key={d.toISOString()} className={`text-center p-2 border-b ${cellMinWidth} ${isWeekendHighlight(d) ? 'bg-accent/30' : isOffPeakDay(d) ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-muted/50'}`}>
                      <div className="font-medium">{format(d, viewMode === 'month' ? 'd' : 'MMM d')}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">{format(d, 'EEE')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gridRows.map(({ plan, price }) => {
                  const baseRate = getBaseRate(plan.id);
                  const effectiveBaseRate = markupPct ? Math.round(baseRate * (1 + markupPct / 100)) : baseRate;
                  return (
                    <tr key={plan.id} className="border-b hover:bg-muted/10">
                      <td className="p-2 sticky left-0 bg-background z-10 border-r" style={{ boxShadow: '2px 0 4px rgba(0,0,0,0.1)' }}>
                        <div className="font-medium text-xs leading-tight">{plan.room_type}</div>
                        <div className="text-[10px] text-muted-foreground">{plan.name}</div>
                      </td>
                      {days.map((d, colIdx) => {
                        const dateStr = format(d, 'yyyy-MM-dd');
                        const key = getCellKey(plan.id, dateStr);
                        const directRate = getEffectiveRate(price, d, plan.id);
                        const rate = applyMarkup(directRate);
                        const isPending = editable && pendingChanges.has(key);
                        const isActive = editable && activeCell === key;
                        const weekend = isWeekendHighlight(d);
                        const inDragRange = editable && isCellInDragRange(plan.id, colIdx);
                        const offPeak = isOffPeakDay(d);
                        const hasOverride = overrideSources.has(key);
                        const varianceColor = !isPending && !inDragRange && rate > 0 ? getCellColor(rate, effectiveBaseRate, weekend, offPeak) : '';
                        const arrow = !isPending && rate > 0 ? getVarianceArrow(rate, effectiveBaseRate) : '';

                        return (
                          <td
                            key={key}
                            className={cn(
                              `text-center p-0.5 ${cellMinWidth}`,
                              editable && 'cursor-pointer',
                              inDragRange && 'border-2 border-dashed border-primary/60 bg-primary/10',
                              !inDragRange && isPending && 'bg-yellow-100 dark:bg-yellow-900/30',
                              !editable && 'cursor-default'
                            )}
                            style={!inDragRange && !isPending && varianceColor ? { backgroundColor: varianceColor } : undefined}
                            onClick={editable ? (e) => !isActive && !drag.isDragging && handleCellClick(plan.id, d, price, colIdx, e.shiftKey) : undefined}
                            onMouseEnter={editable ? () => handleDragEnter(plan.id, colIdx) : undefined}
                          >
                            {isActive ? (
                              <div className="flex items-center">
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
                                    else if (e.key === 'Escape') setActiveCell(null);
                                    else if (e.key === 'ArrowDown') { e.preventDefault(); navigateCell(key, 'down'); }
                                    else if (e.key === 'ArrowUp') { e.preventDefault(); navigateCell(key, 'up'); }
                                    else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
                                      e.preventDefault();
                                      copyToNextCell(key, e.shiftKey);
                                    }
                                    else if (e.key === 'ArrowRight' && (e.target as HTMLInputElement).selectionStart === editValue.length) { e.preventDefault(); navigateCell(key, 'right'); }
                                    else if (e.key === 'ArrowLeft' && (e.target as HTMLInputElement).selectionStart === 0) { e.preventDefault(); navigateCell(key, 'left'); }
                                  }}
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <div className="h-8 flex items-center justify-center text-sm font-mono group relative">
                                <span>
                                  {inDragRange && drag.value !== null
                                    ? formatCurrency(applyMarkup(drag.value))
                                    : rate > 0 ? formatCurrency(rate) : '—'}
                                  {arrow && <span className={`ml-0.5 text-[10px] ${arrow === '▲' ? 'text-green-600' : 'text-orange-600'}`}>{arrow}</span>}
                                </span>
                                {hasOverride && !isPending && rate > 0 && (
                                  <span className="absolute top-0 left-0.5 text-[8px] text-blue-600 dark:text-blue-400 leading-none">◆</span>
                                )}
                                {isPending && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-yellow-500" />}
                                {editable && rate > 0 && !drag.isDragging && (
                                  <div
                                    className="absolute right-0 top-0 bottom-0 w-4 flex items-center justify-center opacity-0 group-hover:opacity-60 hover:!opacity-100 cursor-grab"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleDragStart(plan.id, colIdx, directRate);
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
                  );
                })}
              </tbody>
            </table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground">Loading rates...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterRoomType} onValueChange={setFilterRoomType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Room Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Room Types</SelectItem>
            {roomTypes.map(rt => (
              <SelectItem key={rt} value={rt}>{rt}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterRatePlan} onValueChange={setFilterRatePlan}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Rate Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Rate Plans</SelectItem>
            {ratePlans.map(rp => (
              <SelectItem key={rp.id} value={rp.id}>{rp.room_type} / {rp.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)} className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          Bulk Edit
        </Button>

        <div className="ml-auto flex items-center gap-2">
          {syncSuccess && (
            <Badge className="gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200">
              <Check className="h-3 w-3" />
              Synced
            </Badge>
          )}
          {pendingChanges.size > 0 && (
            <>
              <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300">
                {pendingChanges.size} pending
              </Badge>
              <Button size="sm" onClick={syncNow} disabled={syncing} className="gap-1.5 bg-black text-white hover:bg-black/90">
                <Save className="h-3.5 w-3.5" />
                {syncing ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {(syncing || syncProgress > 0) && (
        <Progress value={syncProgress} className="h-2 [&>div]:bg-black" />
      )}

      {/* Date nav + View toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="icon" onClick={handlePrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {viewMode === 'month'
            ? format(startOfMonth(weekStart), 'MMMM yyyy')
            : `${format(days[0], 'MMM d')} – ${format(days[days.length - 1], 'MMM d, yyyy')}`
          }
        </span>
        <Button variant="ghost" size="icon" onClick={handleNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="text-xs" onClick={handleToday}>
          {viewMode === 'month' ? 'This Month' : 'Today'}
        </Button>

        <div className="ml-auto flex items-center gap-1 border rounded-md p-0.5">
          <Button
            variant={viewMode === '14days' ? 'default' : 'ghost'}
            size="sm"
            className="text-xs h-7 px-3"
            onClick={() => setViewMode('14days')}
          >
            14 Days
          </Button>
          <Button
            variant={viewMode === 'month' ? 'default' : 'ghost'}
            size="sm"
            className="text-xs h-7 px-3"
            onClick={() => {
              setViewMode('month');
              setWeekStart(startOfMonth(weekStart));
            }}
          >
            Month
          </Button>
        </div>
      </div>

      {/* Price variance legend */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#C8E6C9' }} />
          <span>Above base rate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#FFE0B2' }} />
          <span>Below base rate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'hsl(0 70% 97%)' }} />
          <span>Weekend ({weekendDays.map(d => DAY_NAMES[d]).join('–')})</span>
        </div>
        {offPeakDays.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#E3F2FD' }} />
            <span>Off-Peak ({offPeakDays.map(d => DAY_NAMES[d]).join('–')})</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-blue-600 dark:text-blue-400 text-xs leading-none">◆</span>
          <span>Custom Rate</span>
        </div>
      </div>

      {/* Direct Booking Rates Calendar */}
      {renderCalendarGrid(rows, {
        editable: true,
        headerLabel: 'Direct Booking Rates',
        headerSubtitle: 'Net rates for direct bookings',
        headerClassName: 'bg-muted/50',
      })}

      {/* OTA Calendars - one per derived channel */}
      {derivedChannels.map(channel => {
        const channelRows = rows.filter(r => channel.basePlanIds.has(r.plan.id));
        if (channelRows.length === 0) return null;
        return (
          <div key={channel.channelName} className="mt-6">
            {renderCalendarGrid(channelRows, {
              editable: false,
              markupPct: channel.markupPercentage,
              headerLabel: `${channel.channelName} Rates`,
              headerSubtitle: `Standard Rate + ${channel.markupPercentage}% markup`,
              headerClassName: 'bg-blue-50 dark:bg-blue-900/20',
            })}
          </div>
        );
      })}

      {/* Pending changes panel */}
      {pendingChanges.size > 0 && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Pending Changes ({pendingChanges.size})</span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPendingChanges(new Map())}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear All
                </Button>
                <Button size="sm" onClick={syncNow} disabled={syncing} className="gap-1">
                  <Save className="h-3.5 w-3.5" />
                  {syncing ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {Array.from(pendingChanges.values()).map((c, i) => (
                <div key={i} className="text-xs text-muted-foreground">
                  • {c.roomType} / {c.ratePlanName} / {format(new Date(c.date + 'T00:00:00'), 'MMM d')}: {formatCurrency(c.oldRate)} → <span className="text-foreground font-medium">{formatCurrency(c.newRate)}</span>
                </div>
              ))}
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
              Apply a rate to a specific date range for the selected room type and rate plan.
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
            <Button onClick={applyBulkEdit} disabled={!bulkDateFrom || !bulkDateTo || !bulkRate}>Apply Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
