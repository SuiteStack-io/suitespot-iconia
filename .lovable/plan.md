

## Three Changes to the Prices Page

### 1. Show Date-Specific Rate Overrides from `rate_plan_restrictions`

**Current state:** `QuickRateGrid` already fetches from `rate_plan_date_overrides` and shows those overrides. However, it does NOT check `rate_plan_restrictions.rate` — rates set via the Bulk Restriction Editor are invisible in the calendar.

**Fix in `src/components/pms/QuickRateGrid.tsx`:**
- In `fetchDateOverrides()`, also query `rate_plan_restrictions` for rows where `rate IS NOT NULL` and date ranges overlap the visible range
- Merge restriction-based rates into the `dateOverrides` map (date overrides from `rate_plan_date_overrides` take priority if both exist for the same date)
- Expand dates from `date_from`/`date_to` ranges into individual date entries
- In `getEffectiveRate()`, no changes needed — it already reads from `dateOverrides`
- Add visual distinction: cells with an override get a small diamond indicator (◆) and the legend gets a "Custom Rate" entry with the indicator

### 2. Rename and Reorder Tabs

**File:** `src/pages/pms/Prices.tsx` (lines 413-418)

Change tab order from:
- Rate Plans | Price Lab | Pricing Rules

To:
- Rate Plans | Pricing Rules | Rate Calendar

Just reorder the `TabsTrigger` elements and rename "Price Lab" to "Rate Calendar". Keep `TabsContent` values unchanged (just rename the value key).

### 3. Add Separate Direct + OTA Calendars

**File:** `src/components/pms/QuickRateGrid.tsx`

- Fetch `channel_markup_settings` (active) and `derived_rate_plan_mappings` to get OTA channels and their markup percentages
- Build a mapping: for each base rate plan, find its derived plans and markup %
- Render TWO calendar sections stacked vertically:
  1. **"Direct Booking Rates"** — the existing grid (unchanged behavior)
  2. **"Booking.com Rates"** (or whatever channel name is in the DB) — same grid layout but each cell shows `base_rate × (1 + markup/100)`, read-only (no editing)
- Dynamic: read channel names and markups from DB, not hardcoded
- OTA calendars reflect date overrides (the derived rate is calculated from the actual/effective base rate, not the default)
- Visually distinguish with a subtle header color difference (e.g., blue-tinted header for Booking.com)
- OTA grid cells are read-only (no click-to-edit, no drag-to-fill)

### Files Modified
1. `src/pages/pms/Prices.tsx` — tab rename + reorder
2. `src/components/pms/QuickRateGrid.tsx` — fetch restriction rates, add override indicator, add OTA calendar sections

### What Does NOT Change
- Rate Plans tab content
- Pricing Rules tab content
- Rate saving/syncing logic
- Bulk Edit functionality
- Restrictions page
- Room type/rate plan filters

