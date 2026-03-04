

## Remove Min Stay from Rate Plan Dialog, Keep Off-Peak Pricing

### What's changing
1. Remove `min_stay` field from the main pricing grid and unit overrides table in the Rate Plan dialog
2. Remove `min_stay` from `RoomPriceState` interface and all related state/handlers
3. Always show Off-Peak pricing (not conditionally on `offPeakDays.length > 0`) — the field is already there
4. Update the rate plan card display in Prices.tsx to show off-peak rate instead of min stay
5. Update the grid layout from conditional 3/4 cols to always 3 cols (Weekday, Weekend, Off-Peak)

### No database migration needed
- `off_peak_rate` column already exists on `rate_plan_prices` (added in previous migration)
- `min_stay` column stays in DB (used by Restrictions page) but is no longer set from this dialog — new rate plans will use the column default

### Files to edit

**`src/components/pms/RatePlanDialog.tsx`**
- Remove `minStay` state variable and its initialization/reset
- Remove Min Stay input from the 3/4-column pricing grid (line 345-348)
- Always show Off-Peak input (remove `offPeakDays.length > 0` conditional on lines 318-326 and 339-344)
- Remove Min Stay column from unit overrides table (TableHead line 375, TableCell lines 397-398)
- Remove `min_stay` from `RoomPriceState` interface
- Remove `min_stay` from `handleRoomRateChange` field union type
- Always use 3-column grid: Weekday, Weekend, Off-Peak
- In `handleSave`, hardcode `min_stay: 1` in output prices (DB column still expects it)
- Update unit override effective defaults to exclude min_stay

**`src/pages/pms/Prices.tsx`**
- Update rate plan card display (line 516): replace `· {price.min_stay} night min` with off-peak rate display
- Show: `Base: $120 wkday / $135 wknd / $108 off-peak` (or omit off-peak part if null/0)
- Add `off_peak_rate` to `RatePlanPrice` interface (line 55-63)
- Include `off_peak_rate` in the `handleSave` prices insert (line 293-295 — the prices array from dialog already includes it, just needs to pass through)

