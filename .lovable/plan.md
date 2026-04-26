## Make Occupancy by Month chart respect Analytics date range

### 1. Chart component (`src/components/analytics/OccupancyByMonthChart.tsx`)

**Props** — extend the existing `Props` interface with two required strings:
```ts
interface Props {
  propertyId: string | null;
  method?: import('@/lib/revenueDateFilter').RevenueRecognitionMethod;
  startDate: string; // 'yyyy-MM-dd'
  endDate: string;   // 'yyyy-MM-dd'
}
```

Destructure `startDate` and `endDate` in the component signature alongside the existing `propertyId` and `method`.

**Bucket derivation** — replace the hardcoded trailing-6-months `Array.from({ length: 6 }, ...)` block inside the `useEffect` with a range-driven loop:

```ts
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
```

Note: `MMM yy` x-axis label (e.g. `Apr 26`) replaces today's `MMM` so cross-year ranges remain unambiguous; `fullLabel` already uses `MMMM yyyy` for the tooltip. The `MonthBucket` interface itself is unchanged.

**Window for the queries** — keep the existing pattern:
```ts
const windowStart = format(months[0].monthStart, 'yyyy-MM-dd');
const windowEnd = format(months[months.length - 1].monthEnd, 'yyyy-MM-dd');
```
This already drives the `reservations` and `blocked_dates` queries — they continue to work unchanged. The per-month overlap math (occupied nights, available nights, blocked nights, prorated revenue) is left exactly as it is today.

**Effect dependencies** — extend the existing dependency array:
```ts
}, [propertyId, startDate, endDate]);
```

**Empty-range guard** — if `months.length === 0` (shouldn't happen for valid pill ranges, but defensive), set `data` to `[]` and bail out before running queries.

### 2. Analytics page (`src/pages/Analytics.tsx`)

`startDate` and `endDate` are already destructured at line 881 from `getDateRange()` in render scope, and feed every other downstream component (KPI cards, the 4 bottom tables, `CancellationAnalytics`).

Update the single render site at line 1207:
```tsx
<OccupancyByMonthChart
  propertyId={propertyId}
  method={method}
  startDate={startDate}
  endDate={endDate}
/>
```

No new `getDateRange()` call, no new variable declarations.

### 3. Visual handling

Single-bucket ranges (e.g. "7 Days", "Apr") will render one wide bar. Add `barSize={80}` to the `<BarChart>` (or to each `<Bar>`) so a lone bar doesn't stretch across the full chart width. This matches the prompt's "apply only if visual is awkward" guidance — verify after the change and remove if it causes regressions on multi-bar layouts.

### 4. Behavior preserved

- Per-month overlap math (occupied/available nights, blocked-dates handling, cancelled-exclusion filter) — unchanged
- Sub-month range still uses **full-month** denominators (the chart shows monthly trends, not in-range slices)
- "Show Revenue" toggle, tooltip structure, color, axis styling, `LabelList` formatters — unchanged
- KPI cards, the 4 bottom tables, date pills, Custom Range, Export — untouched
- `propertyId` and `method` props — preserved

### Verification

Build with `tsc --noEmit` to confirm no duplicate declarations and that the new prop types line up at the single call site in `Analytics.tsx`.
