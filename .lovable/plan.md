

## Rewrite Room Rates as Read-Only Price Lab Grid

### Goal
Replace the current editable card-based Room Rates page with a read-only version of the Price Lab's calendar grid table. No editing, no database writes, no save button.

### Changes — Single file: `src/pages/RoomRates.tsx`

Complete rewrite to mirror the Price Lab's grid display in read-only mode:

**Data fetching** — Same as QuickRateGrid: fetch `rate_plans` (filtered by property, active, with room_type) and `rate_plan_prices` (where unit_id is null), keyed by rate_plan_id.

**Grid layout** — Replicate the Price Lab table structure:
- Sticky left column: Room Type + Plan Name
- Date columns (14-day or month view) with day headers
- Weekend highlighting (Thu/Fri columns)
- Rate values displayed as `$XXX` in mono font, non-editable
- Color-coded variance from base rate (green = above, orange = below)
- Variance arrows (▲/▼)

**Navigation** — Same prev/next/today controls and 14-day/month view toggle.

**Filters** — Room type and rate plan dropdowns (same as Price Lab toolbar).

**Removed entirely:**
- Save button, all edit handlers, all state for editing (`editedPrices`, `editedPlans`, `hasChanges`, `saving`)
- No `supabase.update()` or `.insert()` calls
- No pending changes, no drag-to-fill, no bulk edit, no cell clicking/input
- No Collapsible card layout

**Kept from current page:**
- SlideMenu + AdminBreadcrumb header
- Loading spinner

**Legend** — Same variance legend as Price Lab (above base, below base, weekend).

### Technical approach
- Import same date-fns helpers, ScrollArea, format utilities
- Reuse `isWeekendRate`, `isWeekendHighlight`, `getCellColor`, `getVarianceArrow`, `formatCurrency` logic inline
- Pure read-only: cells are plain `<td>` with styled text, no click handlers

