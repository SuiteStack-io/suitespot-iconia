

## Reset Rates to $120 Default

### Why the rates are wrong

The current database values for the 4 rate plans on property ICONIA are:
- **Bed & Breakfast Rate** (Double + Twin): weekday=$456.23, weekend=$505
- **Best Available Rate** (Double + Twin): weekday=$444, weekend=$490

These got corrupted because the Quick Rate Editor's `syncNow()` updates the **global** `weekday_rate` / `weekend_rate` on the `rate_plan_prices` row every time you edit any cell. Since there's only one rate per plan (not per-date), editing any single cell changes the rate for all dates.

### Fix: Two steps

#### 1. Reset the 4 rate_plan_prices rows via data update

Update these rows to:
- `weekday_rate` = 120
- `weekend_rate` = 135 (standard 10% markup, rounded to nearest $5)

IDs to update:
- `7bb97c14` (Double Room / B&B)
- `ddfe83b8` (Double Room / BAR)
- `e77b63be` (Twin Room / B&B)
- `2e6ac56f` (Twin Room / BAR)

#### 2. Fix `syncNow()` to stop overwriting base rates

In `src/components/pms/QuickRateGrid.tsx`, remove the `rate_plan_prices` UPDATE from `syncNow()`. Instead, only insert date-specific entries into `channex_sync_queue`. The base rate should only be changed via the Rate Plans tab (RatePlanDialog), not the Quick Editor.

This means the Quick Editor becomes a **Channex-only override tool**: it pushes date-specific rates to Channex without modifying the stored base rates. The grid will still show the base rate for unchanged cells, and pending changes shown in yellow until synced.

### Files to change

| # | File | Change |
|---|------|--------|
| 1 | Database (data update) | Reset 4 `rate_plan_prices` rows to $120/$135 |
| 2 | `src/components/pms/QuickRateGrid.tsx` | Remove `rate_plan_prices` UPDATE from `syncNow()`, keep only `channex_sync_queue` inserts |

