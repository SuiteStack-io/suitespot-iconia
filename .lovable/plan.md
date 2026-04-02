

## Fix: Push Different Weekday vs Weekend Rates in Full Sync and Daily Sync

### Problem
The Full Sync and Daily Sync push a flat `weekday_rate` for every day. The `rate_plan_prices` table has separate `weekday_rate`, `weekend_rate`, and `off_peak_rate` fields, but only `weekday_rate` is used. The process-sync-queue already implements day-of-week splitting but hardcodes the weekend days instead of reading from the property config.

### Root Cause (3 functions)

| Function | Line | Issue |
|----------|------|-------|
| `channex-full-sync` | 273 | `rateInCents = Math.round(p.weekday_rate * 100)` — flat rate for entire range |
| `channex-daily-sync` | 288 | Same: `rateInCents = Math.round(p.weekday_rate * 100)` |
| `channex-process-sync-queue` | 302-303 | Already splits but hardcodes `dow === 4 \|\| 5 \|\| 6` instead of reading property's `weekend_days` |

### Fix

**All 3 files** will use the same approach:

1. Fetch the property's `weekend_days` and `off_peak_days` arrays from the `properties` table (defaults: `[4, 5]` and `[]`)
2. For each date in the range, check the day-of-week against these arrays
3. Use `weekend_rate` for weekend days, `off_peak_rate` for off-peak days (if set), and `weekday_rate` for all other days
4. Collapse consecutive days with the same rate into ranges (to minimize API payload size)

**File 1: `supabase/functions/channex-full-sync/index.ts`**
- After fetching `propertyExists`, also fetch `weekend_days` and `off_peak_days` from the `properties` table
- Replace the flat-rate chunk loop (lines 272-313) with day-by-day iteration that checks day-of-week and picks the correct rate, then collapses into ranges

**File 2: `supabase/functions/channex-daily-sync/index.ts`**
- After fetching `propertyMappings`, fetch each property's `weekend_days` and `off_peak_days`
- Replace the flat-rate chunk loop (lines 287-343) with the same day-by-day + collapse logic

**File 3: `supabase/functions/channex-process-sync-queue/index.ts`**
- Fetch `weekend_days` and `off_peak_days` from the property (using `ratePlanData.property_id`)
- Replace hardcoded `dow === 4 || 5 || 6` (line 303) with `propertyWeekendDays.includes(dow)`
- Add off-peak rate support using `payload.off_peak_rate`

### Key detail: rate selection per day
```text
For each date:
  dow = date.getDay()  // 0=Sun, 6=Sat
  if off_peak_days.includes(dow) && off_peak_rate > 0 → use off_peak_rate
  else if weekend_days.includes(dow) && weekend_rate > 0 → use weekend_rate
  else → use weekday_rate
```

### No database or UI changes needed
All data already exists in the correct tables.

