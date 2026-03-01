

## Fix: Daily Sync "Rate Plan Not Found" Bug

### Root Cause

In `channex-daily-sync/index.ts` line 229, the query selects a column called `default_min_stay` which **does not exist** in the `rate_plans` table. The actual columns are `default_min_stay_arrival` and `default_min_stay_through`.

```
.select("*, default_min_stay, default_max_stay, ...")
//           ^^^^^^^^^^^^^^^^ DOES NOT EXIST
```

This causes PostgREST to return a 400 error, making `ratePlan` null for every rate plan. The code then logs `"Rate plan {local_id}: not found"` -- which is misleading because the rate plan exists, the query just failed.

### Fix in `supabase/functions/channex-daily-sync/index.ts`

1. **Line 229**: Change the `.select()` to just `"*"` (all columns are already included by `*`, and the extra invalid column name breaks the query)

2. **Line 288**: Change `ratePlan.default_min_stay` to `ratePlan.default_min_stay_arrival` (matching the actual column name), and add `default_min_stay_through` usage as `min_stay_through`

3. **Add error checking**: After the rate plan query, check for errors explicitly so future issues are easier to diagnose

### Summary
- One file changed: `supabase/functions/channex-daily-sync/index.ts`
- Fix the invalid column reference that silently breaks all rate plan queries
- This should resolve all 4 recurring daily sync alerts immediately

