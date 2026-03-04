import { useState, useEffect, useMemo, useCallback } from 'react';
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { useAuth } from '@/lib/auth';
import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';
import { useProperty } from '@/lib/propertyContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';

interface RatePlan {
  id: string;
  name: string;
  room_type: string | null;
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

const formatCurrency = (v: number) => `$${v.toLocaleString()}`;

const RoomRates = () => {
  const { userRole } = useAuth();
  const propertyId = usePropertyId();
  const { activeProperty } = useProperty();
  const isMobile = useIsMobile();

  // Property-aware day classification
  const weekendDays = useMemo(() => (activeProperty as any)?.weekend_days ?? [4, 5], [activeProperty]);
  const offPeakDays = useMemo(() => (activeProperty as any)?.off_peak_days ?? [], [activeProperty]);
  const isWeekendRate = useCallback((date: Date) => weekendDays.includes(date.getDay()), [weekendDays]);
  const isOffPeakDay = useCallback((date: Date) => offPeakDays.includes(date.getDay()), [offPeakDays]);
  const isWeekendHighlight = useCallback((date: Date) => weekendDays.includes(date.getDay()), [weekendDays]);

  const [loading, setLoading] = useState(true);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [prices, setPrices] = useState<Record<string, RatePlanPrice>>({});
  const [dateOverrides, setDateOverrides] = useState<Record<string, number>>({});
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [filterRoomType, setFilterRoomType] = useState<string>('all');
  const [filterRatePlan, setFilterRatePlan] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'14days' | 'month'>('14days');

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

      const { data, error } = await supabase
        .from('rate_plan_date_overrides')
        .select('rate_plan_id, override_date, rate')
        .in('rate_plan_id', planIds)
        .gte('override_date', startDate)
        .lte('override_date', endDate);

      if (error) throw error;

      const overrideMap: Record<string, number> = {};
      (data || []).forEach(row => {
        overrideMap[`${row.rate_plan_id}:${row.override_date}`] = Number(row.rate);
      });
      setDateOverrides(overrideMap);
    } catch (err) {
      console.error('Error fetching date overrides:', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, pricesRes] = await Promise.all([
        withPropertyFilter(
          supabase.from('rate_plans').select('id, name, room_type').eq('is_active', true).order('room_type').order('name'),
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

  const getRate = (price: RatePlanPrice | null, date: Date, planId: string): number => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const override = dateOverrides[`${planId}:${dateStr}`];
    if (override !== undefined) return override;
    if (!price) return 0;
    if (isOffPeakDay(date) && price.off_peak_rate != null) return price.off_peak_rate;
    return isWeekendRate(date) ? price.weekend_rate : price.weekday_rate;
  };

  const getBaseRate = (planId: string): number => {
    const price = prices[planId];
    return price ? price.weekday_rate : 0;
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <SlideMenu userRole={userRole} />
            <h1 className="text-xl font-semibold text-foreground">Room Rates</h1>
          </div>
        </div>
        <div className="px-4 pb-3">
          <AdminBreadcrumb section={activeProperty?.name || 'Property'} currentPage="Room Rates" />
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-full mx-auto space-y-4">
        {/* Filters */}
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
        </div>

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

        {/* Legend */}
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
        </div>

        {/* Grid */}
        {rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No rate plans found.</p>
        ) : (
          <ScrollArea className="w-full">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="text-left p-2 border-b bg-muted/50 sticky left-0 z-10 min-w-[160px]" style={{ boxShadow: '2px 0 4px rgba(0,0,0,0.1)' }}>Room / Plan</th>
                  {days.map(d => (
                    <th key={d.toISOString()} className={`text-center p-2 border-b ${cellMinWidth} ${isWeekendHighlight(d) ? 'bg-accent/30' : isOffPeakDay(d) ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-muted/50'}`}>
                      <div className="font-medium">{format(d, viewMode === 'month' ? 'd' : 'MMM d')}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">{format(d, 'EEE')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ plan, price }) => {
                  const baseRate = getBaseRate(plan.id);
                  return (
                    <tr key={plan.id} className="border-b hover:bg-muted/10">
                      <td className="p-2 sticky left-0 bg-background z-10 border-r" style={{ boxShadow: '2px 0 4px rgba(0,0,0,0.1)' }}>
                        <div className="font-medium text-xs leading-tight">{plan.room_type}</div>
                        <div className="text-[10px] text-muted-foreground">{plan.name}</div>
                      </td>
                      {days.map(d => {
                        const rate = getRate(price, d, plan.id);
                        const weekend = isWeekendHighlight(d);
                        const offPeak = isOffPeakDay(d);
                        const varianceColor = rate > 0 ? getCellColor(rate, baseRate, weekend, offPeak) : '';
                        const arrow = rate > 0 ? getVarianceArrow(rate, baseRate) : '';

                        return (
                          <td
                            key={d.toISOString()}
                            className={`text-center p-0.5 ${cellMinWidth}`}
                            style={varianceColor ? { backgroundColor: varianceColor } : undefined}
                          >
                            <div className="h-8 flex items-center justify-center text-sm font-mono">
                              <span>
                                {rate > 0 ? formatCurrency(rate) : '—'}
                                {arrow && <span className={`ml-0.5 text-[10px] ${arrow === '▲' ? 'text-green-600' : 'text-orange-600'}`}>{arrow}</span>}
                              </span>
                            </div>
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
      </main>
    </div>
  );
};

export default RoomRates;
