

## Standardize rate_plan_restrictions to Dollars + Fix Sync Rate Overrides

### Database Migration
Convert existing cent values to dollars:
```sql
UPDATE rate_plan_restrictions SET rate = rate / 100.0 WHERE rate IS NOT NULL;
```

### Code Changes

**1. `src/components/pms/BulkRestrictionEditor.tsx` (line 319)**
Remove `* 100` when writing rates — save dollars directly:
```
- row.rate = Math.round(p.restrictions.rate * 100);
+ row.rate = p.restrictions.rate;
```

**2. `src/components/pms/QuickRateGrid.tsx` (line 222)**
Remove `/ 100` when reading — data is now in dollars:
```
- overrideMap[key] = Number(row.rate) / 100;
+ overrideMap[key] = Number(row.rate);
```

**3. `supabase/functions/channex-push-restrictions/index.ts` (line 94)**
Convert dollars to cents before Channex API call:
```
- if (r.rate != null) value.rate = r.rate;
+ if (r.rate != null) value.rate = Math.round(r.rate * 100);
```

**4. `supabase/functions/channex-full-sync/index.ts`**
After building `dailyRates` from `rate_plan_prices` (around line 300), add rate override logic:
- Fetch `rate_plan_date_overrides` for the rate plan (not currently fetched)
- After the dailyRates loop, overlay overrides in priority order:
  1. `rate_plan_restrictions.rate` → `Math.round(rate * 100)` (now dollars, convert to cents)
  2. `rate_plan_date_overrides.rate` → `Math.round(rate * 100)` (dollars to cents)
  3. Keep default from `rate_plan_prices` (already in cents)

**5. `supabase/functions/channex-daily-sync/index.ts`**
Identical override logic after line 322:
- Fetch `rate_plan_date_overrides` for the rate plan
- After dailyRates loop, overlay restriction rates then date override rates
- Same priority and conversion as full-sync

### What Does NOT Change
- `rate_plan_prices` / `rate_plan_date_overrides` storage (already dollars)
- Channex API format (still expects cents)
- UI display, Bulk Editor UI, Restrictions page
- `channex-sync-rates` function

