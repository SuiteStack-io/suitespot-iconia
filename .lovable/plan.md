

## Plan: Reorganize Filter Layout - Move Date Range to First Row

### Current State
The filters are currently organized in **two rows**:
1. **Row 1**: Search (flex-1), Status dropdown, Units dropdown  
2. **Row 2**: Date Range (with "Date Range" label), Payment, Settled, Source, Currency dropdowns

### Requested Changes
1. Move the Date Range picker up to Row 1 (same line as Search, Status, Units)
2. Reduce the Search input width to make room
3. Remove the "Date Range" text label - keep only the date picker field

---

### Technical Changes

#### File: `src/components/ReservationsList.tsx`

**1. Reduce Search input width (line 782)**

Change the search container from `flex-1` to a fixed max-width:
```tsx
// FROM:
<div className="relative flex-1">

// TO:
<div className="relative flex-1 max-w-md">
```

**2. Add Date Range picker to first row (after line 816, before closing `</div>`)**

Move the Popover component for date range into the first row, removing the wrapper div with the label:

```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button
      variant="outline"
      className={cn(
        "w-full sm:w-[240px] justify-start text-left font-normal",
        !dateRange.from && "text-muted-foreground"
      )}
    >
      <CalendarIcon className="mr-2 h-4 w-4" />
      {dateRange.from ? (
        dateRange.to ? (
          <>
            {format(dateRange.from, "MMM dd, yyyy")} - {format(dateRange.to, "MMM dd, yyyy")}
          </>
        ) : (
          format(dateRange.from, "MMM dd, yyyy")
        )
      ) : (
        <span>Select date range</span>
      )}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0" align="start">
    <Calendar
      mode="range"
      selected={dateRange}
      onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
      numberOfMonths={2}
      initialFocus
      className="pointer-events-auto"
    />
  </PopoverContent>
</Popover>
```

**3. Remove the old Date Range section from Row 2 (lines 821-857)**

Delete the entire `<div className="space-y-2">` wrapper that contains the "Date Range" label and the Popover.

---

### New Layout Structure

**Row 1** (all on same line):
```
[Search (max-w-md)] [Status ▼] [Units ▼] [📅 Date Range picker]
```

**Row 2** (remaining filters):
```
[Payment ▼] [Settled ▼] [Source ▼] [Currency ▼]
```

---

### Files to Modify

| File | Lines | Changes |
|------|-------|---------|
| `src/components/ReservationsList.tsx` | 782, 816-857 | Limit search width, move date range to first row, remove label |

---

### Expected Result

- Search field has a max width (e.g., `max-w-md`) to allow room for other elements
- Date Range picker appears on the same line as Search, Status, and Units
- No "Date Range" label text - just the calendar icon and date display/placeholder
- Cleaner, more compact filter layout

