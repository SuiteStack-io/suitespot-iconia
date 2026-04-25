## Goal

Two fixes to the calendar grid in `src/components/AvailabilityCalendar.tsx`:

1. The room type separator row (e.g., "Deluxe Suite (5)") gets truncated because it's constrained to the narrow first column. Make its content span the full grid width while staying anchored to the left edge during horizontal scroll.
2. Booking cells bleed through the sticky first column when scrolling horizontally because the separator row's first cell uses a translucent background (`bg-muted/50`) and the unit row's sticky cell uses `z-10` (same level as no-z-index siblings, plus a translucent neighbor row leaks through). Make the sticky column fully opaque and bump it above the scrolling content.

## File

`src/components/AvailabilityCalendar.tsx` — three small edits inside the calendar grid markup (lines ~2074–2145). No other file changes.

## Changes

### 1. Header row first cell (line 2075)

Already has `sticky left-0 bg-card z-30 border-r border-border`. Leave it as-is — it's already correctly opaque and above scrolling day headers.

### 2. Separator row (lines 2106–2126) — full-width content, sticky, opaque

Currently the row uses the same `gridTemplateColumns: '64px / 160px repeat(N, 70px)'`, so the icon + name + count cell is locked to the narrow first column and the type name truncates to "D..".

Replace the entire separator row with a single-column grid whose only cell is sticky to the left, fully opaque, and on top:

```tsx
{showSeparator && (
  <div className="grid grid-cols-1 mb-1 border-y border-border">
    <div className="flex items-center gap-2 py-2 px-2 sticky left-0 z-20 bg-muted w-fit max-w-full">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-semibold text-muted-foreground whitespace-nowrap">
        {currentRoomType}
      </span>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        ({roomTypeCount})
      </span>
    </div>
  </div>
)}
```

Key changes:
- `grid grid-cols-1` instead of the day-template grid → content can span full row width
- Removed the empty `displayDays.map` placeholder cells (no longer needed with single-column grid)
- Inner cell: `sticky left-0 z-20 bg-muted` (opaque, was `bg-muted/50` translucent which let booking cells show through)
- `w-fit max-w-full` so the sticky pill hugs the content and stays anchored at the left edge during horizontal scroll, instead of stretching across the full row (which would defeat sticky positioning)
- `whitespace-nowrap` on the type name (replacing `truncate`) so "Deluxe Suite" renders in full now that there's room
- Outer row keeps `border-y border-border` for the visual separator line; dropped `bg-muted/50` from the outer wrapper since the sticky inner pill carries the background

### 3. Unit row sticky first cell (line 2135) — bump z-index

Current:
```tsx
<div className="flex items-center text-sm font-medium p-2 bg-card rounded sticky left-0 z-10 border-r border-border cursor-pointer hover:bg-muted/50 transition-colors">
```

Change `z-10` → `z-20` so the unit cell sits above scrolling booking cells (booking cells have no explicit z-index, so `z-20` cleanly wins). Background `bg-card` is already fully opaque — keep it. Hover state `hover:bg-muted/50` only applies on hover and is not the masking culprit; leave it untouched.

New:
```tsx
<div className="flex items-center text-sm font-medium p-2 bg-card rounded sticky left-0 z-20 border-r border-border cursor-pointer hover:bg-muted/50 transition-colors">
```

The inner unit-number content (lines 2136–2144) is **unchanged** — the mobile vs desktop display logic from the previous prompt stays exactly as it is.

## Out of scope (unchanged)

- Unit cell content (mobile-only `509`, desktop `#509` + type name)
- Column widths (64px mobile / 160px desktop first column, 70px day cells)
- Day header labels, "Today" highlighting, date formatting
- Booking cell content, drag-to-create, click-to-edit, blocked/free cells, source badges, color coding
- Top toolbar, Double Booking Conflict legend, page header
- Data fetching, sorting, filtering logic

## Verification

After the change:
- Mobile: separator row reads "Deluxe Suite (5)" in full (no "D.." truncation), anchored to the left edge; horizontal scroll keeps the pill stuck while day cells slide underneath
- Mobile + desktop: scrolling the calendar horizontally — booking cells slide fully under the sticky first column with no leading-digit bleed-through (e.g., "509" never appears as "09")
- Desktop layout otherwise pixel-identical to before
