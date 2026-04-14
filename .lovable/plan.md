

## Redesign Rate Calendar: Combined Grouped Table

### Overview
Replace the two separate calendar grids (Direct Booking + OTA) with a single table where each room type is a header row, followed by its standard rate row and any OTA rate rows grouped underneath.

### Tab Changes in `src/pages/pms/Prices.tsx`
- Reorder tabs: Rate Plans → Pricing Rules → Rate Calendar
- Tab order in JSX: `rate-plans`, `pricing-rules`, `rate-calendar` (already named correctly, just move Pricing Rules before Rate Calendar in the TabsList)

### Main Redesign in `src/components/pms/QuickRateGrid.tsx`

**Replace `renderCalendarGrid` + the two separate grid calls** with a single combined table:

**Data structure — build grouped rows:**
```text
For each unique room_type (from filteredPlans):
  → Room type header row (bold, bg-muted/30, spans all columns)
  → Standard Rate row: "Standard Rate - {roomType}" — editable, shows effective rate
  → For each derivedChannel that has this plan:
       OTA row: "{channelName} Rate (Standard Rate + {X}% markup)" — read-only, rate × markup
```

**Single table rendering:**
- One `<table>` with one `<thead>` (date headers) and one `<tbody>`
- Room type header: `<tr>` with a single `<td colSpan={days.length + 1}>` showing room type name in bold
- Standard rate row: existing editable cell logic (click-to-edit, drag-to-fill, pending changes, override indicator ◆)
- OTA rows: read-only cells, slightly lighter text (`text-muted-foreground`), no click handlers, no drag handles
- OTA rate = `Math.round(standardRate × (1 + markupPct / 100))`
- OTA rates automatically reflect date overrides (calculated from the effective standard rate)
- Subtle bottom border/spacing between room type groups (`border-b-2` or `mb-1`)

**Left column labels:**
- Standard row: indent slightly (`pl-4`), show "Standard Rate - {roomType}" with plan name below in small text
- OTA row: indent slightly (`pl-4`), show "{channelName} Rate (Standard Rate + {X}% markup)" in muted color

**Dynamic OTA rows:**
- Read channel name and markup from `derivedChannels` state (already fetched from `derived_rate_plan_mappings` / `channel_markup_settings`)
- If a future OTA is added (e.g., Airbnb), it automatically appears as a new row

**Date-specific overrides — already working:**
- `fetchDateOverrides` already reads from both `rate_plan_restrictions` and `rate_plan_date_overrides` with correct priority
- The ◆ indicator already shows for overridden dates
- OTA rows will use the overridden standard rate × markup

### What stays the same
- All toolbar controls (filters, bulk edit, date nav, view toggle, legend)
- Cell editing logic (click, keyboard nav, drag-to-fill, shift-click range)
- Pending changes panel
- Bulk edit dialog
- Save/sync logic
- Override fetching and priority

### Files Modified
1. `src/pages/pms/Prices.tsx` — reorder TabsTrigger elements
2. `src/components/pms/QuickRateGrid.tsx` — replace two-grid rendering with single combined grouped table

