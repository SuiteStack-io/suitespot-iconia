## Fix Target label truncation on Occupancy by Month chart

The red dotted target line's `Target X%` label currently renders as just `T` because `position: 'right'` places it outside the chart's plot area, where Recharts clips it.

### Change

In `src/components/analytics/OccupancyByMonthChart.tsx`, update the `<ReferenceLine>` label config from:

```tsx
label={{
  value: `Target ${occupancyTarget}%`,
  position: 'right',
  fill: '#dc2626',
  fontSize: 11,
  fontWeight: 600,
}}
```

to:

```tsx
label={{
  value: `Target ${occupancyTarget}%`,
  position: 'insideTopRight',
  fill: '#dc2626',
  fontSize: 11,
  fontWeight: 600,
  offset: 5,
}}
```

This anchors the label inside the plot area, above the line and to the right, so the full text stays visible on both desktop and mobile.

### Out of scope

- Line color, dash pattern, stroke width — unchanged
- Tooltip "Target: X%" row — unchanged
- Data fetch and `occupancyTarget` state — unchanged
- Everything else in the file — unchanged
