import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { format, addDays, startOfWeek, endOfWeek, isThursday, isFriday, isSaturday } from 'date-fns';
import { ChevronLeft, ChevronRight, Send, Clock, Trash2, Pencil } from 'lucide-react';
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

const SYNC_DELAY = 30;

const isWeekendDay = (date: Date) => isThursday(date) || isFriday(date) || isSaturday(date);

interface QuickRateGridProps {
  onSyncQueueCount?: (count: number) => void;
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
  const [countdown, setCountdown] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [filterRoomType, setFilterRoomType] = useState<string>('all');
  const [filterRatePlan, setFilterRatePlan] = useState<string>('all');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRate, setBulkRate] = useState('');
  const [bulkRoomType, setBulkRoomType] = useState('all');
  const [bulkRatePlan, setBulkRatePlan] = useState('all');
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    return isWeekendDay(date) ? price.weekend_rate : price.weekday_rate;
  };

  const startCountdown = useCallback(() => {
    if (countdownRef.current) return;
    setCountdown(SYNC_DELAY);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = null;
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Auto-sync when countdown reaches 0
  useEffect(() => {
    if (countdown === null && pendingChanges.size > 0 && !syncing) {
      syncNow();
    }
  }, [countdown]);

  // Ctrl+S handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (pendingChanges.size > 0) syncNow();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pendingChanges]);

  const handleCellClick = (planId: string, date: Date, price: RatePlanPrice | null) => {
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
    const weekend = isWeekendDay(date);
    const oldRate = price ? (weekend ? price.weekend_rate : price.weekday_rate) : 0;

    if (newRate === oldRate) {
      // No change, remove from pending if it was there
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
      startCountdown();
    }
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
      handleCellClick(newPlan.plan.id, newDate, newPlan.price);
    }
  };

  const syncNow = async () => {
    if (pendingChanges.size === 0 || syncing) return;
    setSyncing(true);
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(null);

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

        // Determine new weekday and weekend rates
        let newWeekday = price.weekday_rate;
        let newWeekend = price.weekend_rate;

        for (const c of changes) {
          if (c.isWeekend) newWeekend = c.newRate;
          else newWeekday = c.newRate;
        }

        const { error } = await supabase
          .from('rate_plan_prices')
          .update({ weekday_rate: newWeekday, weekend_rate: newWeekend })
          .eq('id', price.id);

        if (error) throw error;

        // Update local state
        setPrices(prev => ({
          ...prev,
          [planId]: { ...prev[planId], weekday_rate: newWeekday, weekend_rate: newWeekend },
        }));
      }

      // Trigger sync queue processing immediately
      try {
        await supabase.functions.invoke('channex-process-sync-queue', { body: {} });
      } catch {
        // Non-critical - triggers will handle it
      }

      setPendingChanges(new Map());
      toast.success(`${pendingChanges.size} rate changes saved & syncing`);
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

    const targetPlans = ratePlans.filter(p => {
      if (bulkRoomType !== 'all' && p.room_type !== bulkRoomType) return false;
      if (bulkRatePlan !== 'all' && p.id !== bulkRatePlan) return false;
      return true;
    });

    const newPending = new Map(pendingChanges);
    let count = 0;

    for (const plan of targetPlans) {
      const price = prices[plan.id];
      for (const date of days) {
        const dateStr = format(date, 'yyyy-MM-dd');
        const key = getCellKey(plan.id, dateStr);
        const weekend = isWeekendDay(date);
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
    }

    setPendingChanges(newPending);
    if (count > 0) startCountdown();
    setBulkOpen(false);
    setBulkRate('');
    toast.success(`${count} cell(s) updated`);
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
          {pendingChanges.size > 0 && (
            <>
              <Badge variant="secondary" className="gap-1">
                {pendingChanges.size} pending
              </Badge>
              {countdown !== null && (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {countdown}s
                </Badge>
              )}
              <Button size="sm" onClick={syncNow} disabled={syncing} className="gap-1.5">
                <Send className="h-3.5 w-3.5" />
                {syncing ? 'Saving...' : 'Sync Now'}
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
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="text-left p-2 border-b bg-muted/50 sticky left-0 z-10 min-w-[160px]">Room / Plan</th>
                {days.map(d => (
                  <th key={d.toISOString()} className={`text-center p-2 border-b min-w-[80px] ${isWeekendDay(d) ? 'bg-accent/30' : 'bg-muted/50'}`}>
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
                  {days.map(d => {
                    const dateStr = format(d, 'yyyy-MM-dd');
                    const key = getCellKey(plan.id, dateStr);
                    const rate = getEffectiveRate(price, d, plan.id);
                    const isPending = pendingChanges.has(key);
                    const isActive = activeCell === key;
                    const weekend = isWeekendDay(d);

                    return (
                      <td
                        key={key}
                        className={`text-center p-0.5 cursor-pointer transition-colors ${
                          isPending ? 'bg-yellow-100 dark:bg-yellow-900/30' : weekend ? 'bg-accent/10' : ''
                        }`}
                        onClick={() => !isActive && handleCellClick(plan.id, d, price)}
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
                              else if (e.key === 'Escape') setActiveCell(null);
                              else if (e.key === 'ArrowDown') { e.preventDefault(); navigateCell(key, 'down'); }
                              else if (e.key === 'ArrowUp') { e.preventDefault(); navigateCell(key, 'up'); }
                              else if (e.key === 'ArrowRight' && (e.target as HTMLInputElement).selectionStart === editValue.length) { e.preventDefault(); navigateCell(key, 'right'); }
                              else if (e.key === 'ArrowLeft' && (e.target as HTMLInputElement).selectionStart === 0) { e.preventDefault(); navigateCell(key, 'left'); }
                            }}
                            autoFocus
                          />
                        ) : (
                          <div className="h-8 flex items-center justify-center text-sm font-mono">
                            {rate > 0 ? formatCurrency(rate) : '—'}
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
                {countdown !== null && (
                  <span className="text-xs text-muted-foreground">Syncing in {countdown}s...</span>
                )}
                <Button variant="ghost" size="sm" onClick={() => { setPendingChanges(new Map()); if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; } setCountdown(null); }}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear All
                </Button>
                <Button size="sm" onClick={syncNow} disabled={syncing} className="gap-1">
                  <Send className="h-3.5 w-3.5" />
                  Sync Now
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
              Apply a single rate to all visible dates for the selected room type and rate plan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
            <p className="text-xs text-muted-foreground">
              This will update {days.length} dates × {ratePlans.filter(p => (bulkRoomType === 'all' || p.room_type === bulkRoomType) && (bulkRatePlan === 'all' || p.id === bulkRatePlan)).length} rate plan(s) = up to {days.length * ratePlans.filter(p => (bulkRoomType === 'all' || p.room_type === bulkRoomType) && (bulkRatePlan === 'all' || p.id === bulkRatePlan)).length} changes
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button onClick={applyBulkEdit}>Apply Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
