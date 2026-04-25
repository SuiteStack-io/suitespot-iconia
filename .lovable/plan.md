## Add "Occupancy by Month" bar chart to Analytics

A new card placed below the KPI cards (after ADR/RevPAR row, before the Revenue by Source / Revenue by Room grid) showing monthly occupancy % for the last 6 months (current + 5 prior). Independent of the date-range pills.

### 1. Files

Create `src/components/analytics/OccupancyByMonthChart.tsx` (a self-contained component) and import + render it in `src/pages/Analytics.tsx`. Keeps the page file lean and matches the existing pattern of co-locating chart components under `src/components/analytics/`.

No DB schema changes. No new dependencies — recharts is already in use (`src/components/analytics/CancellationAnalytics.tsx` lines 21–33 imports `BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer` from `'recharts'`).

### 2. Component placement in `Analytics.tsx`

Add an import at the top:

```ts
import { OccupancyByMonthChart } from '@/components/analytics/OccupancyByMonthChart';
```

Insert between the KPI grid close and the Revenue Breakdown grid (current lines 1160–1162):

```tsx
        </div>  {/* end KPI grid */}

        {/* Occupancy by Month */}
        <OccupancyByMonthChart propertyId={propertyId} />

        {/* Revenue Breakdown Charts */}
        <div className="grid gap-6 md:grid-cols-2">
```

Component takes `propertyId` only — no `dateRange` prop, since it's always the trailing 6-month window.

### 3. Component structure (`OccupancyByMonthChart.tsx`)

```tsx
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { withPropertyFilter } from '@/hooks/usePropertyFilter';
import { format, startOfMonth, endOfMonth, addMonths, getDaysInMonth, startOfDay, differenceInDays, addDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';

interface Props { propertyId: string | null; }

interface MonthBucket {
  key: string;            // 'yyyy-MM'
  label: string;          // 'Apr'
  fullLabel: string;      // 'April 2026'
  monthStart: Date;
  monthEnd: Date;         // inclusive last day
  daysInMonth: number;
  occupiedNights: number;
  availableNights: number;
  occupancy: number;      // % rounded 1dp
}
```

Render a `Card` with `CardHeader` + `CardTitle="Occupancy by Month"` (matching existing analytic-card typography), `CardContent` wraps a `ResponsiveContainer` (`width="100%" height={300}`) → `BarChart`. Loading state: muted-foreground "Loading…" text inside CardContent. Error state: muted-foreground "Could not load occupancy data" — same minimal pattern used in `StaySurveyAnalytics`.

### 4. Data fetch — single query, exact reuse of Occupancy KPI logic

Source of truth: `src/pages/Analytics.tsx` lines 335–386 (the existing Occupancy KPI calculation). Copy verbatim, only change the date window.

```ts
useEffect(() => {
  if (!propertyId) return;
  let cancelled = false;
  (async () => {
    setLoading(true);
    const now = new Date();
    const months: MonthBucket[] = Array.from({ length: 6 }, (_, i) => {
      const anchor = addMonths(now, -(5 - i)); // oldest → newest
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

    // Same units query as KPI (line 336–339)
    const { data: units } = await withPropertyFilter(
      supabase.from('units').select('id').eq('status', 'available'),
      propertyId
    );
    const totalUnits = units?.length || 0;
    const unitIdSet = new Set((units || []).map(u => u.id));

    // Same reservation filter as KPI (line 343–349) — single query for full 6-month window
    const { data: reservations } = await withPropertyFilter(
      supabase.from('reservations')
        .select('check_in_date, check_out_date, nights, unit_id')
        .in('status', ['confirmed', 'checked-in', 'checked-out', 'completed'])
        .is('cancelled_at', null)
        .lte('check_in_date', windowEnd)
        .gte('check_out_date', windowStart),
      propertyId
    );

    // Single blocked-dates query for the window (mirrors KPI line 375–380)
    const { data: blockedRows } = await supabase
      .from('blocked_dates')
      .select('blocked_date, unit_id')
      .in('unit_id', Array.from(unitIdSet))
      .gte('blocked_date', windowStart)
      .lte('blocked_date', windowEnd);

    // Bucket nights into months — same overlap math as KPI (line 358–371)
    for (const m of months) {
      const start = startOfDay(m.monthStart);
      const end = startOfDay(m.monthEnd); // inclusive last day
      let occupied = 0;
      reservations?.forEach(r => {
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

      const blockedInMonth = blockedRows?.filter(b => {
        const d = b.blocked_date; // 'yyyy-MM-dd' string
        return d >= format(m.monthStart, 'yyyy-MM-dd') && d <= format(m.monthEnd, 'yyyy-MM-dd');
      }).length || 0;

      m.availableNights = (totalUnits * m.daysInMonth) - blockedInMonth;
      m.occupancy = m.availableNights > 0
        ? Math.round((m.occupiedNights / m.availableNights) * 1000) / 10
        : 0;
    }

    if (!cancelled) { setData(months); setLoading(false); }
  })();
  return () => { cancelled = true; };
}, [propertyId]);
```

Key parity points with the existing Occupancy KPI:
- `units` filtered by `status='available'` AND `propertyId` (line 336–339).
- Reservation status filter `['confirmed', 'checked-in', 'checked-out', 'completed']` plus `cancelled_at IS NULL` (line 346–347) — this is exactly how cancellations are excluded today.
- Reservations filtered to those overlapping the window via `check_in_date <= windowEnd AND check_out_date >= windowStart` (line 348–349).
- Per-month overlap math identical to KPI (`overlapEnd = checkOut <= end ? checkOut : addDays(end, 1)`).
- Blocked nights subtracted per month from `(totalUnits * daysInMonth)`.

Result: when the date range pill is set to "This Month", the current-month bar's % will equal the KPI card's %.

### 5. Chart rendering

```tsx
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
          <div className="text-muted-foreground">{m.occupiedNights} / {m.availableNights} nights</div>
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
```

Color: `hsl(var(--primary))` — the project's design-token primary, which is the same token already used by `<BarChart3 className="text-primary" />` in the Analytics header and across the KPI cards. (CancellationAnalytics uses the raw `#ef4444` red specifically because it represents cancellations; that is not the page's "primary chart color" so we don't reuse it.)

### 6. Responsiveness

- Outer `Card` is full-width by default (no `md:col-span` constraint), so it spans the page width on desktop and mobile.
- `ResponsiveContainer width="100%" height={300}` handles desktop/mobile sizing.
- Six bars + 3-letter month labels won't crowd at 360px viewport — no rotation needed (`angle={-45}` is unnecessary and would only be added if labels overlap).

### 7. Out of scope

- KPI cards, Revenue Share slider/Save, date pills (incl. new month pills), Custom Range, Export, Revenue by Source/Room, RevenueByGuests, RevenueByNationality, CancellationAnalytics — none touched.
- Existing Occupancy KPI calculation untouched (read-only reuse).
- No revenue overlay on the new chart.

### Variable-collision check

- All new identifiers (`MonthBucket`, `data`, `loading`, `months`, `windowStart`, `windowEnd`, `units`, `totalUnits`, `unitIdSet`, `reservations`, `blockedRows`, `start`, `end`, `occupied`, `blockedInMonth`) live inside the new `OccupancyByMonthChart` component — zero overlap with `Analytics.tsx` scope.
- In `Analytics.tsx` we add only one new identifier: the imported `OccupancyByMonthChart` component name; no existing import collides.
