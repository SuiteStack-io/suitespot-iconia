import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { format, addDays, startOfWeek, isFriday, isSaturday, isThursday, differenceInDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Send, Trash2, Pencil, GripVertical, Check, CalendarIcon, Save } from 'lucide-react';
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

// Auto-sync removed — manual "Save Changes" only

// Thu/Fri/Sat use weekend_rate pricing
const isWeekendRate = (date: Date) => isThursday(date) || isFriday(date) || isSaturday(date);
// Only Fri/Sat get visual weekend highlight
const isWeekendHighlight = (date: Date) => isFriday(date) || isSaturday(date);

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
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [prices, setPrices] = useState<Record<string, RatePlanPrice>>({});
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [filterRoomType, setFilterRoomType] = useState<string>('all');
  const [filterRatePlan, setFilterRatePlan] = useState<string>('all');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRate, setBulkRate] = useState('');
  const [bulkRoomType, setBulkRoomType] = useState('all');
  const [bulkRatePlan, setBulkRatePlan] = useState('all');
  const [bulkDateFrom, setBulkDateFrom] = useState<Date | undefined>();
  const [bulkDateTo, setBulkDateTo] = useState<Date | undefined>();
  const [lastCommittedCell, setLastCommittedCell] = useState<{ planId: string; colIdx: number; value: number } | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Drag-to-fill state
  const [drag, setDrag] = useState<DragState>({ isDragging: false, planId: null, value: null, startColIdx: 0, currentColIdx: 0 });

  const days = useMemo(() => {
    const numDays = isMobile ? 3 : 7;
    return Array.from({ length: numDays }, (_, i) => addDays(weekStart, i));
  }, [weekStart, isMobile]);

  useEffect(() => {
    fetchData();
  }, [propertyId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, pricesRes] = await Promise.all([
        withPropertyFilter(
          supabase.from('rate_plans').select('id, name, room_type, valid_from, valid_to, property_id').eq('is_active', true).order('room_type').order('name'),
          propertyId
        ),
        supabase.from('rate_plan_prices').select('*').is('unit_id', null),
      ]);
      if (plansRes.error) throw plansRes.error;
      if (pricesRes.error) throw pricesRes.error;

      setRatePlans((plansRes.data || []).filter(p => p.room_type));

      const priceMap: Record<string, RatePlanPrice> = {};
      (pricesRes.data || []).forEach(p => {
        priceMap[p.rate_plan_id] = p;
      });
      setPrices(priceMap);
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
    if (!price) return 0;
    return isWeekendRate(date) ? price.weekend_rate : price.weekday_rate;
  };

  // Auto-sync and countdown removed — manual save only

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
    // Shift+Click range fill
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
    const oldRate = price ? (weekend ? price.weekend_rate : price.weekday_rate) : 0;
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

    try {
      // Group changes by rate plan
      const byPlan = new Map<string, PendingChange[]>();
      pendingChanges.forEach(change => {
        const list = byPlan.get(change.ratePlanId) || [];
        list.push(change);
        byPlan.set(change.ratePlanId, list);
      });

      for (const [planId, changes] of byPlan) {
        const price = prices[planId];
        if (!price) continue;

        // NOTE: We do NOT update rate_plan_prices here.
        // The Quick Editor only pushes date-specific overrides to Channex.
        // Base rates should only be changed via the Rate Plans tab (RatePlanDialog).

        // Insert date-specific entries into channex_sync_queue for precise Channex pushes
        const sortedChanges = [...changes].sort((a, b) => a.date.localeCompare(b.date));
        
        // Check if this rate plan is mapped to Channex
        const { data: mapping } = await supabase
          .from('channex_mappings')
          .select('local_id, channex_id')
          .eq('local_id', planId)
          .eq('entity_type', 'rate_plan')
          .eq('sync_status', 'synced')
          .maybeSingle();

        if (mapping) {
          // Insert per-date sync queue entries
          for (const change of sortedChanges) {
            await supabase.from('channex_sync_queue').insert({
              sync_type: 'rate',
              entity_id: mapping.local_id,
              date_from: change.date,
              date_to: change.date,
              property_id: propertyId || null,
              payload: {
                rate_plan_id: planId,
                room_type: change.roomType,
                weekday_rate: change.isWeekend ? price.weekday_rate : change.newRate,
                weekend_rate: change.isWeekend ? change.newRate : price.weekend_rate,
                triggered_by: 'quick_rate_editor',
                specific_date: change.date,
                specific_rate: change.newRate,
              },
            });
          }
        }
      }

      // Trigger sync queue processing
      try {
        await supabase.functions.invoke('channex-process-sync-queue', { body: {} });
      } catch {
        // Non-critical
      }

      const changeCount = pendingChanges.size;
      setPendingChanges(new Map());
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
      toast.success(`${changeCount} rate change(s) saved & syncing`);
    } catch (err) {
      console.error('Sync error:', err);
      toast.error('Failed to save rate changes');
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

    // Iterate over selected date range
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

  // Drag helpers
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
              <Button size="sm" onClick={syncNow} disabled={syncing} className="gap-1.5">
                <Save className="h-3.5 w-3.5" />
                {syncing ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Date nav */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setWeekStart(prev => addDays(prev, isMobile ? -3 : -7))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {format(days[0], 'MMM d')} – {format(days[days.length - 1], 'MMM d, yyyy')}
        </span>
        <Button variant="ghost" size="icon" onClick={() => setWeekStart(prev => addDays(prev, isMobile ? 3 : 7))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}>
          Today
        </Button>
      </div>

      {/* Grid */}
      {rows.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No rate plans found. Create rate plans in the Rate Plans tab first.</p>
      ) : (
        <ScrollArea className="w-full">
          <table className="w-full border-collapse text-sm select-none">
            <thead>
              <tr>
                <th className="text-left p-2 border-b bg-muted/50 sticky left-0 z-10 min-w-[160px]">Room / Plan</th>
                {days.map((d, colIdx) => (
                  <th key={d.toISOString()} className={`text-center p-2 border-b min-w-[90px] ${isWeekendHighlight(d) ? 'bg-accent/30' : 'bg-muted/50'}`}>
                    <div className="font-medium">{format(d, 'MMM d')}</div>
                    <div className="text-[10px] text-muted-foreground font-normal">{format(d, 'EEE')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ plan, price }) => (
                <tr key={plan.id} className="border-b hover:bg-muted/10">
                  <td className="p-2 sticky left-0 bg-background z-10 border-r">
                    <div className="font-medium text-xs leading-tight">{plan.room_type}</div>
                    <div className="text-[10px] text-muted-foreground">{plan.name}</div>
                  </td>
                  {days.map((d, colIdx) => {
                    const dateStr = format(d, 'yyyy-MM-dd');
                    const key = getCellKey(plan.id, dateStr);
                    const rate = getEffectiveRate(price, d, plan.id);
                    const isPending = pendingChanges.has(key);
                    const isActive = activeCell === key;
                    const weekend = isWeekendHighlight(d);
                    const inDragRange = isCellInDragRange(plan.id, colIdx);

                    return (
                      <td
                        key={key}
                        className={`text-center p-0.5 cursor-pointer transition-colors relative ${
                          inDragRange
                            ? 'border-2 border-dashed border-primary/60 bg-primary/10'
                            : isPending
                              ? 'bg-yellow-100 dark:bg-yellow-900/30'
                              : weekend
                                ? 'bg-accent/10'
                                : ''
                        }`}
                        onClick={(e) => !isActive && !drag.isDragging && handleCellClick(plan.id, d, price, colIdx, e.shiftKey)}
                        onMouseEnter={() => handleDragEnter(plan.id, colIdx)}
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
                            <span>{inDragRange && drag.value !== null ? formatCurrency(drag.value) : rate > 0 ? formatCurrency(rate) : '—'}</span>
                            {isPending && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-yellow-500" />}
                            {/* Drag handle */}
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
              ))}
            </tbody>
          </table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

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
