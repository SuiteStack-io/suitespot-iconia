

## Fix Per-Day Availability Calculation

### Analysis

After reviewing all three files, here's the status:

1. **`channex-booking-webhook/index.ts`** — **BROKEN**. The `pushScopedAvailForRange` function (lines 488-529) counts overlapping reservations for the ENTIRE date range as a single number, then pushes that single availability value for the whole range. This is the root cause of the bug (pushing 9 for all of March 21-24).

2. **`channex-process-sync-queue/index.ts`** — **Already correct**. The `calculateAvailabilityRanges` function (line 542) already does day-by-day with `r.check_in_date <= ds && r.check_out_date > ds` and collapses into ranges.

3. **`channex-full-sync/index.ts`** — **Already correct**. Line 143 already does `r.check_in_date <= ds && r.check_out_date > ds` day-by-day with range collapsing.

### Fix: `channex-booking-webhook/index.ts`

Replace the `pushScopedAvailForRange` function (lines 488-529) with proper day-by-day calculation:

- Fetch all overlapping reservations for the date range (same as current)
- Fetch all blocked dates in the range
- Loop day-by-day: for each day, count occupied units where `check_in_date <= day AND check_out_date > day`
- Collapse consecutive days with the same availability into ranges
- Push all ranges in a single batched API call to Channex
- Log the full payload

This reuses the same proven pattern already working in `channex-process-sync-queue` and `channex-full-sync`.

### No changes needed
- `channex-process-sync-queue` — already correct
- `channex-full-sync` — already correct

