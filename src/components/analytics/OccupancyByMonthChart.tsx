import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from 'recharts';

interface Props {
  propertyId: string | null;
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
}

export const OccupancyByMonthChart = ({ propertyId }: Props) => {
  const [data, setData] = useState<MonthBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(false);
      try {
        const now = new Date();
        const months: MonthBucket[] = Array.from({ length: 6 }, (_, i) => {
          const anchor = addMonths(now, -(5 - i)); // oldest -> newest
          const ms = startOfMonth(anchor);
          const me = endOfMonth(anchor);
          return {
            key: format(ms, 'yyyy-MM'),
            label: format(ms, 'MMM'),
            fullLabel: format(ms, 'MMMM yyyy'),
            monthStart: ms,
            monthEnd: me,
            daysInMonth: getDaysInMonth(ms),
            occupiedNights: 0,
            availableNights: 0,
            occupancy: 0,
          };
        });

        const windowStart = format(months[0].monthStart, 'yyyy-MM-dd');
        const windowEnd = format(months[5].monthEnd, 'yyyy-MM-dd');

        // Same units source as the Occupancy KPI card
        const { data: units, error: unitsErr } = await withPropertyFilter(
          supabase.from('units').select('id').eq('status', 'available'),
          propertyId,
        );
        if (unitsErr) throw unitsErr;
        const totalUnits = units?.length || 0;
        const unitIdSet = new Set((units || []).map((u: any) => u.id));

        // Same reservation filter as the KPI card (excludes cancelled)
        const { data: reservations, error: resErr } = await withPropertyFilter(
          supabase
            .from('reservations')
            .select('check_in_date, check_out_date, nights, unit_id')
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
          reservations?.forEach((r: any) => {
            if (!r.unit_id || !unitIdSet.has(r.unit_id)) return;
            const checkIn = startOfDay(new Date(r.check_in_date));
            const checkOut = startOfDay(new Date(r.check_out_date));
            const overlapStart = checkIn > start ? checkIn : start;
            const overlapEnd = checkOut <= end ? checkOut : addDays(end, 1);
            if (overlapStart < overlapEnd) {
              occupied += differenceInDays(overlapEnd, overlapStart);
            }
          });
          m.occupiedNights = occupied;

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
  }, [propertyId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Occupancy by Month</CardTitle>
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
            <BarChart data={data} margin={{ top: 24, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 12 }} />
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
                    </div>
                  );
                }}
              />
              <Bar dataKey="occupancy" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                <LabelList
                  dataKey="occupancy"
                  position="top"
                  formatter={(v: number) => `${v.toFixed(1)}%`}
                  style={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
