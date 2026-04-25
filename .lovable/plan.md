## Goal

On mobile only (below `sm` / 640px), simplify the leftmost column of the calendar grid in `src/components/AvailabilityCalendar.tsx` so booking cells get more horizontal space:

- Hide the unit type/name (e.g., "Deluxe Suite") on mobile
- Show only the unit number, without the `#` prefix (e.g., `509` instead of `#509`)
- Reduce the first column width on mobile from 160px to 64px
- Keep desktop (`sm` and up) unchanged

The room type group header row ("Deluxe Suite (5)" with `Building2` icon, around lines 2106–2118) stays unchanged on both breakpoints — it provides the type context on mobile.

## File

`src/components/AvailabilityCalendar.tsx` — three small edits, all inside the calendar grid markup.

## Changes

### 1. Responsive grid template column width (3 occurrences)

Replace the hard-coded `160px` first column with a responsive value derived from `isMobile` (already in scope at line 274 via `useIsMobile()`).

- Line **2074** (header row)
- Line **2109** (room type separator row)
- Line **2131** (unit row)

Change:
```ts
style={{ gridTemplateColumns: `160px repeat(${displayDays.length}, 70px)` }}
```
to:
```ts
style={{ gridTemplateColumns: `${isMobile ? 64 : 160}px repeat(${displayDays.length}, 70px)` }}
```

This narrows the sticky left column on phones, freeing ~96px of horizontal space per row for booking cells. Day cells remain 70px so more days are visible without horizontal scrolling.

### 2. Unit cell content (lines 2135–2142)

Current:
```tsx
<div className="flex items-center text-sm font-medium p-2 bg-card rounded sticky left-0 z-10 border-r border-border cursor-pointer hover:bg-muted/50 transition-colors">
  <div>
    <div className="text-primary hover:underline">
      {unit.booking_com_name || unit.name}
    </div>
    <div className="text-xs text-muted-foreground">#{unit.unit_number}</div>
  </div>
</div>
```

Change to (hide type name on mobile, drop `#` on mobile, bolder/larger number on mobile):
```tsx
<div className="flex items-center text-sm font-medium p-2 bg-card rounded sticky left-0 z-10 border-r border-border cursor-pointer hover:bg-muted/50 transition-colors">
  <div>
    <div className="hidden sm:block text-primary hover:underline">
      {unit.booking_com_name || unit.name}
    </div>
    <div className="text-sm font-semibold sm:text-xs sm:font-normal sm:text-muted-foreground">
      <span className="sm:hidden">{unit.unit_number}</span>
      <span className="hidden sm:inline">#{unit.unit_number}</span>
    </div>
  </div>
</div>
```

This keeps desktop pixel-identical (type name on top, `#509` muted underneath) while on mobile rendering only `509` in a slightly larger/bolder weight, centered vertically in the now-narrower 64px column.

### 3. Header label "Unit" (line 2075)

Stays unchanged — short enough to fit in 64px.

## Out of scope (unchanged)

- Room type separator row with `Building2` icon and "Deluxe Suite (5)" count
- Day header columns, "Today" highlighting, MMM/d formatting
- Booking cells, drag-to-create, click-to-edit, blocked cells, free cells, color coding, source badges
- Top toolbar (By Type / Export PDF / fullscreen)
- Page header in `src/pages/Index.tsx`
- Data fetching, sorting, filtering logic
- Database/`unit_number` storage — display-layer only

## Verification

After the change on mobile (<640px):
- First column is ~64px wide showing just `509`, `518`, etc.
- Group header still shows "Deluxe Suite (5)" with the building icon
- More day columns visible before horizontal scroll kicks in
- Desktop view unchanged
