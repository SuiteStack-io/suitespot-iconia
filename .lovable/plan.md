

## Bug: Price Lab changes revert when switching tabs

### Root Cause
The `syncNow` function in `QuickRateGrid.tsx` (line 479-492) only updates **local React state** (`setPrices`) after saving. It does **not** persist the new rates to the `rate_plan_prices` database table. When you switch to the "Rate Plans" tab and back, the component remounts, `fetchData()` runs, and reloads the old values from the database.

### Fix
In `syncNow()`, after pushing to the Channex sync queue and before updating local state, **also update the `rate_plan_prices` table** in the database with the new weekday/weekend rates. This ensures the changes persist across tab switches and page reloads.

### Changes — `src/components/pms/QuickRateGrid.tsx`

After the Channex sync queue push (around line 476), add a database update step:

1. Group pending changes by `ratePlanId`
2. For each rate plan with changes, update `rate_plan_prices` with the new `weekday_rate` and/or `weekend_rate` using the existing `prices[planId].id` to target the correct row
3. Since multiple changes for the same plan may set different date-specific rates, use the **last changed value** for weekday and weekend rates respectively (matching the existing local state update logic at lines 484-489)

The update will be a simple `supabase.from('rate_plan_prices').update({ weekday_rate, weekend_rate }).eq('id', priceId)` call for each affected rate plan.

### Files to edit
- `src/components/pms/QuickRateGrid.tsx` — add DB persistence in `syncNow()` before the local state update

