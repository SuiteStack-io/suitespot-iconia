import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { withPropertyFilter } from '@/hooks/usePropertyFilter';
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  getDaysInMonth,
  startOfDay,
  differenceInDays,
  addDays,
} from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Legend,
  ReferenceLine,
} from 'recharts';

interface Props {
  propertyId: string | null;
  method?: import('@/lib/revenueDateFilter').RevenueRecognitionMethod;
  startDate: string; // 'yyyy-MM-dd'
  endDate: string;   // 'yyyy-MM-dd'
}

interface MonthBucket {
  key: string;
  label: string;
  fullLabel: string;
  monthStart: Date;
  monthEnd: Date;
  daysInMonth: number;
  occupiedNights: number;
  availableNights: number;
  occupancy: number;
  netRevenue: number;
}

const REVENUE_COLOR = 'hsl(142 71% 45%)'; // emerald — visually distinct from primary blue

const formatCurrencyShort = (v: number): string => {
  if (v >= 1000) return `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(v).toLocaleString()}`;
};

const formatCurrencyFull = (v: number): string =>
  `$${Math.round(v).toLocaleString()}`;

export const OccupancyByMonthChart = ({ propertyId, method = 'check_in', startDate, endDate }: Props) => {
  const [data, setData] = useState<MonthBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showRevenue, setShowRevenue] = useState(false);
  const [occupancyTarget, setOccupancyTarget] = useState<number | null>(null);

  useEffect(() => {
    if (!propertyId) {
      setOccupancyTarget(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('occupancy_target_annual')
        .eq('id', propertyId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('Failed to fetch occupancy target:', error);
        setOccupancyTarget(null);
        return;
      }
      const value = (data as any)?.occupancy_target_annual;
      setOccupancyTarget(typeof value === 'number' ? value : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(false);
      try {
        const rangeStart = startOfMonth(new Date(startDate));
        const rangeEnd = endOfMonth(new Date(endDate));
        const months: MonthBucket[] = [];
        let cursor = rangeStart;
        while (cursor <= rangeEnd) {
          const ms = startOfMonth(cursor);
          const me = endOfMonth(cursor);
          months.push({
            key: format(ms, 'yyyy-MM'),
            label: format(ms, 'MMM yy'),
            fullLabel: format(ms, 'MMMM yyyy'),
            monthStart: ms,
            monthEnd: me,
            daysInMonth: getDaysInMonth(ms),
            occupiedNights: 0,
            availableNights: 0,
            occupancy: 0,
            netRevenue: 0,
          });
          cursor = addMonths(cursor, 1);
        }

        if (months.length === 0) {
          if (!cancelled) {
            setData([]);
            setLoading(false);
          }
          return;
        }

        const windowStart = format(months[0].monthStart, 'yyyy-MM-dd');
        const windowEnd = format(months[months.length - 1].monthEnd, 'yyyy-MM-dd');

        // Same units source as the Occupancy KPI card
        const { data: units, error: unitsErr } = await withPropertyFilter(
          supabase.from('units').select('id').eq('status', 'available'),
          propertyId,
        );
        if (unitsErr) throw unitsErr;
        const totalUnits = units?.length || 0;
        const unitIdSet = new Set((units || []).map((u: any) => u.id));

        // Same reservation filter as the KPI card (excludes cancelled).
        // Net Revenue = total_price - commission_amount (Analytics.tsx line 283)
        const { data: reservations, error: resErr } = await withPropertyFilter(
          supabase
            .from('reservations')
            .select('check_in_date, check_out_date, nights, unit_id, total_price, commission_amount')
            .in('status', ['confirmed', 'checked-in', 'checked-out', 'completed'])
            .is('cancelled_at', null)
            .lte('check_in_date', windowEnd)
            .gte('check_out_date', windowStart),
          propertyId,
        );
        if (resErr) throw resErr;

        // Blocked dates within the full window (mirrors KPI card)
        const unitIds = Array.from(unitIdSet) as string[];
        const { data: blockedRows, error: blockedErr } = unitIds.length
          ? await supabase
              .from('blocked_dates')
              .select('blocked_date, unit_id')
              .in('unit_id', unitIds)
              .gte('blocked_date', windowStart)
              .lte('blocked_date', windowEnd)
          : { data: [] as any[], error: null };
        if (blockedErr) throw blockedErr;

        for (const m of months) {
          const start = startOfDay(m.monthStart);
          const end = startOfDay(m.monthEnd); // inclusive last day
          let occupied = 0;
          let revenue = 0;
          reservations?.forEach((r: any) => {
            if (!r.unit_id || !unitIdSet.has(r.unit_id)) return;
            const checkIn = startOfDay(new Date(r.check_in_date));
            const checkOut = startOfDay(new Date(r.check_out_date));
            const overlapStart = checkIn > start ? checkIn : start;
            const overlapEnd = checkOut <= end ? checkOut : addDays(end, 1);
            if (overlapStart < overlapEnd) {
              const nightsInMonth = differenceInDays(overlapEnd, overlapStart);
              occupied += nightsInMonth;

              // Prorate net revenue by share of total reservation nights in this month
              const totalNights = differenceInDays(checkOut, checkIn);
              if (totalNights > 0) {
                const totalPrice = Number(r.total_price) || 0;
                const commission = Number(r.commission_amount) || 0;
                const netForReservation = totalPrice - commission;
                revenue += netForReservation * (nightsInMonth / totalNights);
              }
            }
          });
          m.occupiedNights = occupied;
          m.netRevenue = Math.round(revenue);

          const monthStartStr = format(m.monthStart, 'yyyy-MM-dd');
          const monthEndStr = format(m.monthEnd, 'yyyy-MM-dd');
          const blockedInMonth =
            blockedRows?.filter((b: any) => {
              const d = b.blocked_date as string;
              return d >= monthStartStr && d <= monthEndStr;
            }).length || 0;

          m.availableNights = totalUnits * m.daysInMonth - blockedInMonth;
          m.occupancy =
            m.availableNights > 0
              ? Math.round((m.occupiedNights / m.availableNights) * 1000) / 10
              : 0;
        }

        if (!cancelled) {
          setData(months);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [propertyId, startDate, endDate]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Occupancy by Month</CardTitle>
        <div className="flex items-center gap-2">
          <Label
            htmlFor="show-revenue-toggle"
            className="text-sm font-normal text-muted-foreground cursor-pointer"
          >
            Show Revenue
          </Label>
          <Switch
            id="show-revenue-toggle"
            checked={showRevenue}
            onCheckedChange={setShowRevenue}
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : error ? (
          <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
            Could not load occupancy data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 24, right: 12, left: 0, bottom: 4 }} barSize={80}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis
                yAxisId="occupancy"
                unit="%"
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
              />
              {showRevenue && (
                <YAxis
                  yAxisId="revenue"
                  orientation="right"
                  tick={{ fontSize: 12, fill: REVENUE_COLOR }}
                  tickFormatter={(v: number) => formatCurrencyShort(v)}
                />
              )}
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const m: MonthBucket = payload[0].payload;
                  return (
                    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                      <div className="font-medium">{m.fullLabel}</div>
                      <div>Occupancy: {m.occupancy.toFixed(1)}%</div>
                      <div className="text-muted-foreground">
                        {m.occupiedNights} / {m.availableNights} nights
                      </div>
                      {showRevenue && (
                        <div
                          className="mt-1 pt-1 border-t"
                          style={{ color: REVENUE_COLOR }}
                        >
                          Net Revenue: {formatCurrencyFull(m.netRevenue)}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              {showRevenue && (
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  iconType="square"
                  formatter={(value) =>
                    value === 'occupancy' ? 'Occupancy' : 'Net Revenue'
                  }
                />
              )}
              <Bar
                yAxisId="occupancy"
                dataKey="occupancy"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                name="occupancy"
              >
                <LabelList
                  dataKey="occupancy"
                  position="top"
                  formatter={(v: number) => `${v.toFixed(1)}%`}
                  style={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                />
              </Bar>
              {showRevenue && (
                <Bar
                  yAxisId="revenue"
                  dataKey="netRevenue"
                  fill={REVENUE_COLOR}
                  radius={[4, 4, 0, 0]}
                  name="netRevenue"
                >
                  <LabelList
                    dataKey="netRevenue"
                    position="top"
                    formatter={(v: number) => formatCurrencyFull(v)}
                    style={{ fontSize: 11, fill: REVENUE_COLOR }}
                  />
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
