

# Plan: Day-of-Week Default Restrictions

## Summary
Replace the single-value `default_min_stay_arrival` and `default_min_stay_through` columns with 7-element integer arrays (Sun–Sat), update the DefaultRestrictionsCard UI to show a day-of-week table with presets, and update the calendar view to resolve effective defaults per day of week.

---

## Database Migration

Replace the two integer columns with integer arrays on `rate_plans`:

```sql
ALTER TABLE rate_plans 
  ALTER COLUMN default_min_stay_arrival TYPE INTEGER[] USING ARRAY[default_min_stay_arrival, default_min_stay_arrival, default_min_stay_arrival, default_min_stay_arrival, default_min_stay_arrival, default_min_stay_arrival, default_min_stay_arrival],
  ALTER COLUMN default_min_stay_arrival SET DEFAULT '{1,1,1,1,1,1,1}';

ALTER TABLE rate_plans 
  ALTER COLUMN default_min_stay_through TYPE INTEGER[] USING ARRAY[default_min_stay_through, default_min_stay_through, default_min_stay_through, default_min_stay_through, default_min_stay_through, default_min_stay_through, default_min_stay_through],
  ALTER COLUMN default_min_stay_through SET DEFAULT '{1,1,1,1,1,1,1}';
```

This preserves existing data by expanding the current single value to all 7 days. Array index 0 = Sunday, 6 = Saturday (matching JS `Date.getDay()`).

---

## Files to Modify

### 1. `src/components/pms/DefaultRestrictionsCard.tsx`
**Major rewrite.** Replace the two single number inputs with:
- A 7-row table: columns for Day, Min Stay Arrival (number input), Min Stay Through (number input)
- Days labeled Sunday through Saturday
- Helper text above the table explaining both field meanings
- Quick preset buttons below the table:
  - "Weekday: 1 / Weekend: 2" — sets Sun/Sat to 2, Mon–Fri to 1
  - "All days: 1" — resets everything to 1
  - "All days: 2" — sets everything to 2
- Keep the existing Max Stay, Stop Sell, CTA, CTD controls as-is (these remain single values)
- Update the `Defaults` interface to use `number[]` for both min stay fields
- Update fetch/save to handle arrays
- Validation: every array element must be >= 1

### 2. `src/pages/pms/Restrictions.tsx`
- Update `RatePlan` interface: `default_min_stay_arrival` and `default_min_stay_through` become `number[] | null`
- No query changes needed (select already fetches these columns)

### 3. `src/components/pms/RestrictionCalendarView.tsx`
- Update `RatePlanOption` interface: both default min stay fields become `number[]`
- Update effective value resolution in the calendar cell rendering:
  - Instead of `plan.default_min_stay_arrival ?? 1`, use `(plan.default_min_stay_arrival?.[d.getDay()] ?? 1)` where `d` is the date object for that cell
  - Same for `default_min_stay_through`
- Update `openCellEdit` to resolve defaults by day of week

### 4. `supabase/functions/channex-push-restrictions/index.ts`
No changes needed. This function pushes date-specific `rate_plan_restrictions` rows (which still use single integer values per date range). The day-of-week defaults only affect the UI display and are not pushed as restrictions — they serve as fallback values when no date-specific override exists.

### 5. `src/integrations/supabase/types.ts`
Will be auto-updated after migration. The columns will change from `number | null` to `number[] | null`.

---

## Priority Resolution (unchanged)
1. Date-specific restriction from `rate_plan_restrictions` table (highest)
2. Day-of-week default from `rate_plans` arrays (new)
3. Fallback value of 1

---

## Technical Notes
- The `USING` clause in the migration converts existing single integer values to 7-element arrays, so no data loss occurs
- The Channex push function does not need changes because it only sends date-specific overrides from `rate_plan_restrictions`, not defaults
- The `rate_plan_restrictions` table columns (`min_stay_arrival`, `min_stay_through`) remain as single integers — they represent overrides for specific date ranges

