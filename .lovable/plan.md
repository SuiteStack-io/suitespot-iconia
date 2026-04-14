

## Add Current Rates Display to Bulk Restriction Editor

### Changes — 1 File: `src/components/pms/BulkRestrictionEditor.tsx`

**New state & data fetching:**
- Add `currentRates` state holding `{ weekday_rate, weekend_rate, off_peak_rate, room_type }` from `rate_plan_prices`
- Add `derivedMarkups` state holding `{ channel_name, markup_percentage }[]` from `derived_rate_plan_mappings`
- Add `hasDateOverrides` boolean state
- On `selectedRoomType` change (when not "all"), fetch:
  1. `rate_plan_prices` joined via `rate_plan_id` to `rate_plans` where `rate_plans.room_type = selectedRoomType` and `unit_id IS NULL` — take the first match for base rates
  2. `derived_rate_plan_mappings` where `base_rate_plan_id` matches any rate plan for this room type — get `channel_name` and `markup_percentage`
  3. `rate_plan_date_overrides` count where `rate_plan_id` matches — set `hasDateOverrides = count > 0`
- Clear rates when "All Room Types" is selected

**New UI — insert between line 361 (end of dropdowns div) and line 363 (date range):**
- Render a compact info card only when `selectedRoomType !== 'all'` and `currentRates` is loaded
- Light blue/gray background card (`bg-muted/50 border rounded-md p-3`)
- Header: `Current Rates — {selectedRoomType}` in `text-sm font-medium`
- Line 1: `Standard: Weekday $99 · Weekend $120` + `· Off-Peak $85` only if off_peak_rate is set
- For each derived markup: `Booking.com (+18%): Weekday $117 · Weekend $142` (calculated as `Math.round(base * (1 + markup/100))`)
- If `hasDateOverrides`: muted note "Note: Date-specific overrides may apply for some dates in this range"
- If no rates found: show "No rates configured for this room type"

**What does NOT change:**
- Rate & Restrictions checkboxes, Apply/Clear buttons, Pending Changes section
- Restrictions Calendar tab, Rate Plan Settings tab
- How rates are saved or synced

