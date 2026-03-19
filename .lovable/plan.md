

## Fix: Weekly Summary Revenue Calculation

### Problem
The revenue numbers in the weekly summary email are wrong because the calculation differs from the Revenue Analytics page in two ways:

1. **Wrong date filter** — The weekly summary filters revenue by `created_at` (when the booking was created in the system). The Analytics page filters by `check_in_date` (when the stay starts). This misattributes revenue to the wrong week.

2. **No cancellation filter** — The weekly summary includes cancelled reservations in revenue totals. The Analytics page excludes them with `.neq('status', 'Cancelled').is('cancelled_at', null)`.

### Fix

**File: `supabase/functions/generate-weekly-summary/index.ts`**

Update the `computeWeekRevenue` function to match the Analytics page exactly:

- Change the date filter from `created_at` to `check_in_date`
- Add `.neq('status', 'Cancelled')` and `.is('cancelled_at', null)` filters
- Keep the same `total_price - commission_amount` net revenue formula (that part is correct)

Before:
```ts
.gte("created_at", `${start}T00:00:00`)
.lte("created_at", `${end}T23:59:59`)
```

After:
```ts
.neq("status", "Cancelled")
.is("cancelled_at", null)
.gte("check_in_date", start)
.lte("check_in_date", end)
```

The same fix should also be applied to the monthly summary's revenue calculation for consistency.

