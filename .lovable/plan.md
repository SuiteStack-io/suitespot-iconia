## Add Occupancy Target Reference Line — Prompt 2 of 3

Adds a red dotted horizontal reference line at `properties.occupancy_target_annual` to the Occupancy by Month chart. Average line stays out of scope (Prompt 3).

### File touched
- `src/components/analytics/OccupancyByMonthChart.tsx`

### 1. Imports

Add `ReferenceLine` to the existing recharts import block (alongside `BarChart`, `Bar`, `XAxis`, `YAxis`, etc.).

### 2. Fetch the target value (separate effect)

Add a new `useState` and `useEffect` — kept independent of the existing reservations/blocked-dates effect:

```ts
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
  return () => { cancelled = true; };
}, [propertyId]);
```

- `.maybeSingle()` so missing rows return `null` without throwing.
- Cast as `any` since generated types may not yet include the new column.
- "All Properties" view (`propertyId === null`) → target stays `null`, no line rendered.
- `0` is a valid target (renders flat at bottom); only `null`/non-number suppresses the line.

### 3. Axis identifier

The existing left Y-axis already uses `yAxisId="occupancy"` (line 234). Reuse that id on the `<ReferenceLine>` — no axis change needed. Domain is already `[0, 100]`, so a 100% target renders correctly.

### 4. Render the ReferenceLine

Inside `<BarChart>`, after the axes and before/around the existing `<Bar>` elements:

```tsx
{occupancyTarget !== null && (
  <ReferenceLine
    y={occupancyTarget}
    yAxisId="occupancy"
    stroke="#dc2626"
    strokeDasharray="4 4"
    strokeWidth={2}
    label={{
      value: `Target ${occupancyTarget}%`,
      position: 'right',
      fill: '#dc2626',
      fontSize: 11,
      fontWeight: 600,
    }}
  />
)}
```

### 5. Tooltip update

The chart already uses a custom `content` component (Tooltip at line 247). Extend it to render an extra row when `occupancyTarget !== null`:

```tsx
{occupancyTarget !== null && (
  <div className="mt-1 pt-1 border-t" style={{ color: '#dc2626' }}>
    Target: {occupancyTarget}%
  </div>
)}
```

Inserted inside the existing tooltip popover, after the occupancy/nights rows and after the optional revenue row. `occupancyTarget` is in the closure of the parent component, so no new prop wiring is needed.

### 6. Out of scope (Prompt 3)
- Black average line
- Average row in tooltip
- Any change to bars, occupancy math, revenue toggle, axis scales, props, or `Analytics.tsx`

### 7. Safety checks
- No duplicate variable declarations (`occupancyTarget` declared once).
- Reuses existing `yAxisId="occupancy"` — no risk of orphaned axis ids.
- Revenue right axis untouched.
