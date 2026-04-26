## Add Average Occupancy Label to Chart Header

Add a small text label showing the average occupancy across the months currently displayed in the "Occupancy by Month" chart, placed next to the "Show Revenue" toggle.

### File
`src/components/analytics/OccupancyByMonthChart.tsx`

### Changes

**1. Add `useMemo` import**

Update the React import:
```tsx
import { useEffect, useMemo, useState } from 'react';
```

**2. Compute the average**

Right after the existing state declarations (after `occupancyTarget` state), add:
```tsx
const averageOccupancy = useMemo(() => {
  if (!data || data.length === 0) return null;
  const validMonths = data.filter(
    (m) => typeof m.occupancy === 'number' && !Number.isNaN(m.occupancy)
  );
  if (validMonths.length === 0) return null;
  const sum = validMonths.reduce((acc, m) => acc + m.occupancy, 0);
  return sum / validMonths.length;
}, [data]);
```

The field name `m.occupancy` matches the existing `MonthBucket` interface (verified — it's defined as `occupancy: number` and assigned via `m.occupancy = ...` in the bucket loop).

**3. Render the label in the header**

Modify the existing header's right-side flex container (currently holds the `Label` + `Switch`) to insert the average label as a sibling BEFORE the "Show Revenue" label:

```tsx
<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
  <CardTitle>Occupancy by Month</CardTitle>
  <div className="flex items-center gap-2">
    {averageOccupancy !== null && (
      <span className="text-sm text-muted-foreground mr-2">
        Avg: {averageOccupancy.toFixed(1)}%
      </span>
    )}
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
```

### Out of scope
- No reference line on the chart
- No tooltip changes
- No changes to red Target line, bar rendering, occupancy math, toggle behavior, date pills, or anything outside this single component
