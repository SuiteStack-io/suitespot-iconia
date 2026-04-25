## Add "Show Revenue" toggle to Occupancy by Month chart

Add a `Switch` toggle in the card header. When ON, the chart renders a second green Net Revenue bar grouped beside the blue Occupancy bar per month, with its own right-side y-axis. When OFF, the chart looks pixel-identical to today.

### 1. File

Single file: `src/components/analytics/OccupancyByMonthChart.tsx`. No changes to `Analytics.tsx` or any other file.

### 2. Toggle UI

Add `Switch` (from `@/components/ui/switch`) + `Label` (from `@/components/ui/label`) to `CardHeader`:

```tsx
<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
  <CardTitle>Occupancy by Month</CardTitle>
  <div className="flex items-center gap-2">
    <Label htmlFor="show-revenue-toggle" className="text-sm font-normal text-muted-foreground cursor-pointer">
      Show Revenue
    </Label>
    <Switch id="show-revenue-toggle" checked={showRevenue} onCheckedChange={setShowRevenue} />
  </div>
</CardHeader>
```

Local state only: `const [showRevenue, setShowRevenue] = useState(false);` — default OFF, no persistence.

### 3. Net revenue calculation (single fetch, prorated)

Source of truth: `src/pages/Analytics.tsx` line 283 — `netRevenue = total_price - commission_amount`. Column name confirmed via DB introspection: `commission_amount` (the prompt's `ota_commission` does not exist).

Extend the EXISTING `.select()` (line 89) to include the two new columns — no second query:

```ts
.select('check_in_date, check_out_date, nights, unit_id, total_price, commission_amount')
```

Add `netRevenue: number` to the `MonthBucket` interface and initialize to `0`.

Inside the existing per-month loop (line 110), accumulate prorated revenue using the same overlap calculation:

```ts
let revenue = 0;
reservations?.forEach((r: any) => {
  // ...existing overlap logic...
  if (overlapStart < overlapEnd) {
    const nightsInMonth = differenceInDays(overlapEnd, overlapStart);
    occupied += nightsInMonth;

    // Prorate net revenue by share of total nights in this month
    const totalNights = differenceInDays(checkOut, checkIn);
    if (totalNights > 0) {
      const totalPrice = Number(r.total_price) || 0;
      const commission = Number(r.commission_amount) || 0;
      const netForReservation = totalPrice - commission;
      revenue += netForReservation * (nightsInMonth / totalNights);
    }
  }
});
m.netRevenue = Math.round(revenue);
```

Same status filter / `cancelled_at IS NULL` is already in place, so cancelled reservations are excluded by construction. `commission_amount` null → coerced to 0 via `Number(...) || 0`, matching existing KPI behavior.

### 4. Chart rendering — grouped bars when toggle ON

Add `yAxisId` to the existing occupancy bar/axis. Conditionally render a right-side y-axis and a second `<Bar>` when `showRevenue` is true:

```tsx
<YAxis yAxisId="occupancy" unit="%" domain={[0, 100]} tick={{ fontSize: 12 }} />
{showRevenue && (
  <YAxis
    yAxisId="revenue"
    orientation="right"
    tick={{ fontSize: 12, fill: REVENUE_COLOR }}
    tickFormatter={(v: number) => formatCurrencyShort(v)}
  />
)}

<Bar yAxisId="occupancy" dataKey="occupancy" fill="hsl(var(--primary))" radius={[4,4,0,0]} name="occupancy">
  <LabelList dataKey="occupancy" position="top" formatter={(v) => `${v.toFixed(1)}%`} ... />
</Bar>

{showRevenue && (
  <Bar yAxisId="revenue" dataKey="netRevenue" fill={REVENUE_COLOR} radius={[4,4,0,0]} name="netRevenue">
    <LabelList dataKey="netRevenue" position="top" formatter={(v) => formatCurrencyFull(v)} ... />
  </Bar>
)}
```

Recharts auto-groups two `<Bar>` elements side-by-side per category — no extra config needed. Each month gets a blue Occupancy bar (% label on top) and a green Net Revenue bar (e.g. `$30,100` label on top).

Add a `<Legend>` only when `showRevenue` is true so users can distinguish the two series.

### 5. Color

`REVENUE_COLOR = 'hsl(142 71% 45%)'` (emerald-600 equivalent) — distinct from the primary blue used for occupancy. The page does not currently use a token for "revenue green"; this is a one-off chart-series color defined as a constant inside the component (same pattern as CancellationAnalytics line 317 using `#ef4444` for its red bar).

### 6. Tooltip & label formatters

Two formatter helpers inside the file:

```ts
const formatCurrencyShort = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${Math.round(v).toLocaleString()}`;
const formatCurrencyFull = (v: number) => `$${Math.round(v).toLocaleString()}`;
```

- Right y-axis ticks: short form (`$50k`, `$5.2k`).
- Bar-top labels: full form (`$30,100`).
- Tooltip extended to include a Net Revenue line in green when toggle is ON; unchanged when OFF.

### 7. What stays unchanged

- Existing occupancy fetch logic, filters, overlap math, blocked-dates handling — untouched.
- When toggle is OFF: no right axis, no second bar, no legend → chart is pixel-identical to current behavior.
- No DB changes, no `Analytics.tsx` changes, no other components affected.
- No persistence of toggle state.

### Variable-collision check

- New identifiers in component scope: `showRevenue`, `setShowRevenue`, `REVENUE_COLOR`, `formatCurrencyShort`, `formatCurrencyFull`, `revenue`, `nightsInMonth`, `totalNights`, `totalPrice`, `commission`, `netForReservation`. All net-new — none clash with existing names in the file.
- `MonthBucket` extended with one new field (`netRevenue`) — interface modified, not redeclared.
- `<YAxis>` now has `yAxisId="occupancy"` — same component, just keyed; no duplicate declaration.
