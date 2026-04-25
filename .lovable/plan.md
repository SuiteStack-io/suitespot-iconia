## Goal

Make the room type separator row in the calendar grid a continuous grey band edge-to-edge, instead of only showing grey behind the left-anchored sticky pill.

## File

`src/components/AvailabilityCalendar.tsx` — single line edit at line 2107.

## Change

Add `bg-muted` to the outer wrapper of the separator row.

Before:
```tsx
<div className="grid grid-cols-1 mb-1 border-y border-border">
```

After:
```tsx
<div className="grid grid-cols-1 mb-1 border-y border-border bg-muted">
```

The inner sticky pill (`sticky left-0 z-20 bg-muted w-fit max-w-full`) stays exactly as-is — its `bg-muted` now blends seamlessly into the row background while remaining anchored to the left edge during horizontal scroll.

## Out of scope (unchanged)

- Inner sticky pill classes
- Unit row sticky cell, header row, day cells, booking cells
- Column widths (64px mobile / 160px desktop / 70px day cells)
- Unit row content (mobile `509`, desktop `#509` + type name)
- Z-index hierarchy elsewhere
- Double Booking Conflict legend, top toolbar, page header
- Data fetching, sorting, filtering

## Verification

- Separator row is a continuous grey band from left to right edge on both mobile and desktop
- Icon + type name + count stay anchored to the left edge during horizontal scroll
- Booking cells still slide cleanly under the sticky first column with no bleed-through
- `border-y` lines above and below the separator remain visible
