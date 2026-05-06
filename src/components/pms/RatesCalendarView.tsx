import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RangeSelectActionBar } from './RangeSelectActionBar';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  addDays,
  getDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight, RefreshCw, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';
import { useAuth } from '@/lib/auth';

interface RatesCalendarViewProps {
  readOnly?: boolean;
}

interface RatePlan {
  id: string;
  name: string;
  room_type: string | null;
}

interface DerivedMapping {
  base_rate_plan_id: string;
  channel_name: string;
  markup_percentage: number;
}

interface OccupancyMonth {
  unitsTotal: number;
  unitIds: string[];
  perDate: Record<string, Set<string>>; // dateStr -> set of booked unit ids
}

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
const monthKey = (d: Date) => format(d, 'yyyy-MM');

const occColor = (pct: number, hasUnits: boolean): string => {
  if (!hasUnits) return 'bg-muted/30';
  if (pct >= 100) return 'bg-red-300/70';
  if (pct >= 86) return 'bg-orange-200/80';
  if (pct >= 61) return 'bg-yellow-100';
  return 'bg-green-100';
};

export const RatesCalendarView: React.FC<RatesCalendarViewProps> = ({ readOnly = false }) => {
  const propertyId = usePropertyId();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [derivedMappings, setDerivedMappings] = useState<DerivedMapping[]>([]);
  const [selectedRoomType, setSelectedRoomType] = useState<string>('');
  const [selectedRatePlanId, setSelectedRatePlanId] = useState<string>('');
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(new Date()));

  // Caches
  // engineCache[roomType][ratePlanId][yyyy-mm][dateStr] = rate
  const [engineCache, setEngineCache] = useState<
    Record<string, Record<string, Record<string, Record<string, number>>>>
  >({});
  const [overridesCache, setOverridesCache] = useState<
    Record<string, Record<string, Set<string>>>
  >({});
  const [occupancyCache, setOccupancyCache] = useState<
    Record<string, Record<string, OccupancyMonth>>
  >({});

  const [busy, setBusy] = useState(false);

  // Override edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editDate, setEditDate] = useState<string>('');
  const [editValue, setEditValue] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [editEngineRate, setEditEngineRate] = useState<number | null>(null);
  const [editDerivedRate, setEditDerivedRate] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // ── Drag-select state ──
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const anchorRef = useRef<string | null>(null);
  const pressRef = useRef<{ x: number; y: number; t: number; ds: string; timer: number | null } | null>(null);
  const justSelectedRef = useRef<boolean>(false);

  // ── Load rate plans + derived mappings ──
  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [plansRes, derivedRes] = await Promise.all([
          withPropertyFilter(
            supabase
              .from('rate_plans')
              .select('id, name, room_type, valid_from, valid_to, property_id')
              .eq('is_active', true)
              .order('room_type')
              .order('name'),
            propertyId
          ),
          withPropertyFilter(
            supabase
              .from('derived_rate_plan_mappings')
              .select('id, base_rate_plan_id, channel_markup_id, channel_name, markup_percentage'),
            propertyId
          ),
        ]);
        if (cancelled) return;
        if (plansRes.error) throw plansRes.error;
        const plans = ((plansRes.data as any[]) || []).filter(p => p.room_type) as RatePlan[];
        setRatePlans(plans);
        setDerivedMappings(((derivedRes.data as any[]) || []) as DerivedMapping[]);

        const roomTypes = Array.from(
          new Set(plans.map(p => p.room_type).filter(Boolean) as string[])
        ).sort();
        if (roomTypes.length > 0) {
          const rt = roomTypes[0];
          setSelectedRoomType(prev => prev || rt);
          const firstPlan = plans
            .filter(p => p.room_type === (selectedRoomType || rt))
            .sort((a, b) => a.name.localeCompare(b.name))[0];
          setSelectedRatePlanId(prev => prev || firstPlan?.id || '');
        }
      } catch (e) {
        console.error('load rate plans error', e);
        toast.error('Failed to load rate plans');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const roomTypes = useMemo(
    () =>
      Array.from(new Set(ratePlans.map(p => p.room_type).filter(Boolean) as string[])).sort(),
    [ratePlans]
  );

  const ratePlansForRoomType = useMemo(
    () =>
      ratePlans
        .filter(p => p.room_type === selectedRoomType)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [ratePlans, selectedRoomType]
  );

  // Reset rate plan when room type changes
  useEffect(() => {
    if (!selectedRoomType) return;
    const first = ratePlansForRoomType[0];
    if (!first) {
      setSelectedRatePlanId('');
      return;
    }
    if (!ratePlansForRoomType.some(p => p.id === selectedRatePlanId)) {
      setSelectedRatePlanId(first.id);
    }
  }, [selectedRoomType, ratePlansForRoomType, selectedRatePlanId]);

  const monthStartDate = useMemo(() => startOfMonth(viewMonth), [viewMonth]);
  const monthEndDate = useMemo(() => endOfMonth(viewMonth), [viewMonth]);
  const mKey = monthKey(viewMonth);
  const monthStartStr = ymd(monthStartDate);
  const monthEndStr = ymd(monthEndDate);

  const derivedMappingForPlan = useMemo(
    () => derivedMappings.find(d => d.base_rate_plan_id === selectedRatePlanId) || null,
    [derivedMappings, selectedRatePlanId]
  );

  // ── Fetch engine rates for current (roomType, ratePlanId, month) ──
  const fetchEngine = useCallback(
    async (force = false) => {
      if (!propertyId || !selectedRoomType || !selectedRatePlanId) return;
      const cached = engineCache[selectedRoomType]?.[selectedRatePlanId]?.[mKey];
      if (cached && !force) return;

      setBusy(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          'calculate-dynamic-price-batch',
          {
            body: {
              property_id: propertyId,
              room_type: selectedRoomType,
              rate_plan_id: selectedRatePlanId,
              date_from: monthStartStr,
              date_to: monthEndStr,
            },
          }
        );
        if (error) throw error;
        if (!(data as any)?.success) throw new Error((data as any)?.error || 'engine error');
        const map: Record<string, number> = {};
        ((data as any).rates as any[]).forEach(r => {
          if (r?.target_date && typeof r.final_rate === 'number') {
            map[r.target_date] = r.final_rate;
          }
        });
        setEngineCache(prev => {
          const next = { ...prev };
          next[selectedRoomType] = { ...(next[selectedRoomType] || {}) };
          next[selectedRoomType][selectedRatePlanId] = {
            ...(next[selectedRoomType][selectedRatePlanId] || {}),
            [mKey]: map,
          };
          return next;
        });
      } catch (e) {
        console.error('engine fetch error', e);
      } finally {
        setBusy(false);
      }
    },
    [propertyId, selectedRoomType, selectedRatePlanId, mKey, monthStartStr, monthEndStr, engineCache]
  );

  // ── Fetch overrides for current (roomType, month) ──
  const fetchOverrides = useCallback(
    async (force = false) => {
      if (!propertyId || !selectedRoomType) return;
      const cached = overridesCache[selectedRoomType]?.[mKey];
      if (cached && !force) return;
      try {
        const { data, error } = await supabase
          .from('pricing_overrides')
          .select('override_date, room_type')
          .eq('property_id', propertyId)
          .gte('override_date', monthStartStr)
          .lte('override_date', monthEndStr);
        if (error) throw error;
        const set = new Set<string>();
        ((data as any[]) || []).forEach(row => {
          if (row.room_type === null || row.room_type === selectedRoomType) {
            set.add(row.override_date);
          }
        });
        setOverridesCache(prev => {
          const next = { ...prev };
          next[selectedRoomType] = { ...(next[selectedRoomType] || {}), [mKey]: set };
          return next;
        });
      } catch (e) {
        console.error('overrides fetch error', e);
      }
    },
    [propertyId, selectedRoomType, mKey, monthStartStr, monthEndStr, overridesCache]
  );

  // ── Fetch occupancy for current (roomType, month) ──
  const fetchOccupancy = useCallback(
    async (force = false) => {
      if (!propertyId || !selectedRoomType) return;
      const cached = occupancyCache[selectedRoomType]?.[mKey];
      if (cached && !force) return;
      try {
        const { data: unitsData, error: unitsErr } = await supabase
          .from('units')
          .select('id')
          .eq('property_id', propertyId)
          .eq('name', selectedRoomType)
          .neq('status', 'maintenance');
        if (unitsErr) throw unitsErr;
        const unitIds = ((unitsData as any[]) || []).map(u => u.id as string);
        const perDate: Record<string, Set<string>> = {};

        if (unitIds.length > 0) {
          const dayAfter = ymd(addDays(monthEndDate, 1));
          const { data: resData, error: resErr } = await supabase
            .from('reservations')
            .select('unit_id, check_in_date, check_out_date, status')
            .in('status', ['confirmed', 'checked-in', 'completed'])
            .in('unit_id', unitIds)
            .lt('check_in_date', dayAfter)
            .gt('check_out_date', monthStartStr);
          if (resErr) throw resErr;
          const days = eachDayOfInterval({ start: monthStartDate, end: monthEndDate });
          days.forEach(d => {
            perDate[ymd(d)] = new Set<string>();
          });
          ((resData as any[]) || []).forEach(r => {
            if (!r.unit_id) return;
            const ci = r.check_in_date as string;
            const co = r.check_out_date as string;
            days.forEach(d => {
              const ds = ymd(d);
              if (ci <= ds && ds < co) perDate[ds].add(r.unit_id);
            });
          });
        }

        setOccupancyCache(prev => {
          const next = { ...prev };
          next[selectedRoomType] = {
            ...(next[selectedRoomType] || {}),
            [mKey]: { unitsTotal: unitIds.length, unitIds, perDate },
          };
          return next;
        });
      } catch (e) {
        console.error('occupancy fetch error', e);
      }
    },
    [propertyId, selectedRoomType, mKey, monthStartStr, monthStartDate, monthEndDate]
  );

  useEffect(() => {
    fetchEngine();
  }, [fetchEngine]);
  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);
  useEffect(() => {
    fetchOccupancy();
  }, [fetchOccupancy]);

  const handleRefresh = () => {
    fetchEngine(true);
    fetchOverrides(true);
    fetchOccupancy(true);
  };

  // ── Build calendar grid (Mon-start) ──
  const gridCells = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStartDate, end: monthEndDate });
    // Mon-start: getDay() returns 0(Sun)..6(Sat). leading = (getDay - 1 + 7) % 7
    const leading = (getDay(monthStartDate) + 6) % 7;
    const trailingTotal = (leading + days.length) % 7;
    const trailing = trailingTotal === 0 ? 0 : 7 - trailingTotal;
    const cells: Array<Date | null> = [];
    for (let i = 0; i < leading; i++) cells.push(null);
    days.forEach(d => cells.push(d));
    for (let i = 0; i < trailing; i++) cells.push(null);
    return cells;
  }, [monthStartDate, monthEndDate]);

  const engineMap =
    engineCache[selectedRoomType]?.[selectedRatePlanId]?.[mKey] || {};
  const overridesSet = overridesCache[selectedRoomType]?.[mKey] || new Set<string>();
  const occMonth = occupancyCache[selectedRoomType]?.[mKey];

  const openEdit = (date: Date) => {
    if (readOnly) return;
    const ds = ymd(date);
    const eng = engineMap[ds];
    if (eng === undefined) {
      toast.message('Engine rate not loaded yet for this date');
    }
    setEditDate(ds);
    setEditEngineRate(eng ?? null);
    setEditDerivedRate(
      eng !== undefined && derivedMappingForPlan
        ? Math.round(eng * (1 + Number(derivedMappingForPlan.markup_percentage) / 100))
        : null
    );
    setEditValue(eng !== undefined ? String(Math.round(eng)) : '');
    setEditReason('');
    setEditOpen(true);
  };

  const saveOverride = async () => {
    if (!propertyId || !selectedRoomType || !editDate) return;
    const valueNum = Number(editValue);
    if (!Number.isFinite(valueNum) || valueNum <= 0) {
      toast.error('Enter a valid rate');
      return;
    }
    setEditSaving(true);
    try {
      const { data: existing, error: selErr } = await supabase
        .from('pricing_overrides')
        .select('id')
        .eq('property_id', propertyId)
        .eq('override_date', editDate)
        .eq('room_type', selectedRoomType)
        .maybeSingle();
      if (selErr) throw selErr;

      if (existing?.id) {
        const { error: updErr } = await supabase
          .from('pricing_overrides')
          .update({
            value: valueNum,
            override_type: 'fixed_rate',
            reason: editReason || null,
            created_by: user?.id || null,
          })
          .eq('id', existing.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase.from('pricing_overrides').insert({
          property_id: propertyId,
          override_date: editDate,
          room_type: selectedRoomType,
          override_type: 'fixed_rate',
          value: valueNum,
          reason: editReason || null,
          created_by: user?.id || null,
        });
        if (insErr) throw insErr;
      }

      // Trigger sync (best-effort)
      try {
        await supabase.functions.invoke('channex-full-sync', {
          body: { property_id: propertyId, date_from: editDate, date_to: editDate },
        });
      } catch (e) {
        console.warn('channex-full-sync failed (non-blocking)', e);
      }

      toast.success('Override saved');
      setEditOpen(false);
      // Invalidate caches for current slots
      setEngineCache(prev => {
        const next = { ...prev };
        if (next[selectedRoomType]?.[selectedRatePlanId]) {
          const planMap = { ...next[selectedRoomType][selectedRatePlanId] };
          delete planMap[mKey];
          next[selectedRoomType] = { ...next[selectedRoomType], [selectedRatePlanId]: planMap };
        }
        return next;
      });
      setOverridesCache(prev => {
        const next = { ...prev };
        if (next[selectedRoomType]) {
          const m = { ...next[selectedRoomType] };
          delete m[mKey];
          next[selectedRoomType] = m;
        }
        return next;
      });
      // Refetch
      setTimeout(() => {
        fetchEngine(true);
        fetchOverrides(true);
      }, 50);
    } catch (e: any) {
      console.error('save override error', e);
      toast.error(e?.message || 'Failed to save override');
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground p-4">Loading rate calendar…</div>;
  }

  if (roomTypes.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No room types configured for this property.
      </div>
    );
  }

  const monthLabel = format(viewMonth, 'MMMM yyyy');
  const rangeLabel = `${format(monthStartDate, 'MMM d, yyyy')} – ${format(monthEndDate, 'MMM d, yyyy')}`;

  return (
    <div className="space-y-4">
      {/* Top controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[180px]">
          <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
            <SelectTrigger>
              <SelectValue placeholder="Room type" />
            </SelectTrigger>
            <SelectContent>
              {roomTypes.map(rt => (
                <SelectItem key={rt} value={rt}>
                  {rt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[200px]">
          <Select
            value={selectedRatePlanId}
            onValueChange={setSelectedRatePlanId}
            disabled={ratePlansForRoomType.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={ratePlansForRoomType.length === 0 ? 'No rate plans' : 'Rate plan'}
              />
            </SelectTrigger>
            <SelectContent>
              {ratePlansForRoomType.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setViewMonth(prev => subMonths(prev, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="px-3 min-w-[150px] text-center">
            <div className="font-medium text-sm">{monthLabel}</div>
            <div className="text-xs text-muted-foreground">{rangeLabel}</div>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setViewMonth(prev => addMonths(prev, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="outline" onClick={handleRefresh} disabled={busy} className="gap-2">
          <RefreshCw className={cn('h-4 w-4', busy && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="border rounded-md overflow-hidden">
        <div className="grid grid-cols-7 bg-muted text-xs font-medium">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="px-2 py-2 text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {gridCells.map((cell, idx) => {
            if (!cell) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="aspect-square md:aspect-auto md:min-h-[110px] bg-muted/30 border-t border-l first:border-l-0"
                />
              );
            }
            const ds = ymd(cell);
            const eng = engineMap[ds];
            const derived =
              eng !== undefined && derivedMappingForPlan
                ? Math.round(eng * (1 + Number(derivedMappingForPlan.markup_percentage) / 100))
                : null;
            const hasOverride = overridesSet.has(ds);
            const unitsTotal = occMonth?.unitsTotal ?? 0;
            const bookedSet = occMonth?.perDate?.[ds] ?? new Set<string>();
            const bookedCount = bookedSet.size;
            const pct = unitsTotal > 0 ? (bookedCount / unitsTotal) * 100 : 0;
            const bg = occColor(pct, unitsTotal > 0);
            const clickable = !readOnly;

            return (
              <button
                key={ds}
                type="button"
                disabled={!clickable}
                onClick={() => openEdit(cell)}
                className={cn(
                  'relative text-left border-t border-l first:border-l-0 min-h-[110px] p-2 flex flex-col gap-1.5 transition-colors',
                  bg,
                  clickable
                    ? 'hover:brightness-95 cursor-pointer'
                    : 'cursor-default'
                )}
              >
                <div className="flex items-start justify-between">
                  <span className="text-xs font-medium text-foreground">
                    {format(cell, 'MMM d')}
                  </span>
                  {hasOverride && (
                    <Lock className="h-3.5 w-3.5 text-purple-700" aria-label="Manual override" />
                  )}
                </div>

                <div className="flex-1 flex flex-col items-center justify-center gap-1">
                  {eng !== undefined ? (
                    <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-purple-600 text-white">
                      ${Math.round(eng)}
                    </span>
                  ) : selectedRatePlanId ? (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  ) : null}
                  {derived !== null && (
                    <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-orange-500 text-white">
                      ${derived}
                    </span>
                  )}
                </div>

                {/* Occupancy bar */}
                {unitsTotal > 0 && (
                  <div className="w-full">
                    {unitsTotal === 1 ? (
                      <div className="h-1.5 w-full rounded bg-blue-50">
                        <div
                          className={cn(
                            'h-full rounded',
                            bookedCount > 0 ? 'bg-blue-600' : 'bg-blue-100'
                          )}
                          style={{ width: bookedCount > 0 ? '100%' : '0%' }}
                        />
                      </div>
                    ) : (
                      <div className="flex gap-0.5 h-1.5 w-full">
                        {Array.from({ length: unitsTotal }).map((_, i) => {
                          const unitId = occMonth?.unitIds[i];
                          const filled = unitId ? bookedSet.has(unitId) : false;
                          return (
                            <div
                              key={i}
                              className={cn(
                                'flex-1 rounded-sm',
                                filled ? 'bg-blue-600' : 'bg-blue-100'
                              )}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col md:flex-row md:gap-10 gap-4">
        <div>
          <div className="text-sm font-semibold text-muted-foreground mb-1.5">Room Occupancy</div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-green-100 border" /> Available (0–60%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-yellow-100 border" /> Filling up (61–85%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-orange-200 border" /> Almost sold out (86–99%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-red-300 border" /> Sold out (100%)
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-purple-700" /> Manual override
            </span>
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold text-muted-foreground mb-1.5">Room Rates</div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-purple-600" /> Base rate (PMS)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: '#003580' }} /> Booking.com rate
            </span>
          </div>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override rate</DialogTitle>
            <DialogDescription>
              {selectedRoomType} • {editDate}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground space-y-1">
              <div>
                Engine rate:{' '}
                <span className="font-medium text-foreground">
                  {editEngineRate !== null ? `$${Math.round(editEngineRate)}` : '—'}
                </span>
              </div>
              {editDerivedRate !== null && (
                <div>
                  Derived rate:{' '}
                  <span className="font-medium text-foreground">${editDerivedRate}</span>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="override-value">New rate (USD)</Label>
              <Input
                id="override-value"
                type="number"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                min={0}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="override-reason">Reason (optional)</Label>
              <Textarea
                id="override-reason"
                value={editReason}
                onChange={e => setEditReason(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={saveOverride} disabled={editSaving}>
              {editSaving ? 'Saving…' : 'Save override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RatesCalendarView;
