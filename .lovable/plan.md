

## Fix Availability Sync: Old Date Range & Checkout Date Bugs

### Bug 1: Modified reservations don't sync old date range

**Root cause**: The `notify_channex_availability_change()` trigger function (created in migration `20260216093044`) only queues the NEW dates on UPDATE. When a reservation's dates change (e.g., March 20-27 → March 22-29), the old range (March 20-22) never gets its availability restored in Channex.

**Fix**: SQL migration to update the trigger function. On UPDATE, detect if `check_in_date` or `check_out_date` changed. If so, queue TWO sync entries — one for the old date range and one for the new date range. Also handle cancellations (status changed to 'cancelled') by queuing the freed dates.

### Bug 2: Checkout date counted as occupied

**Root cause**: The `calculateAvailability()` function in `channex-process-sync-queue/index.ts` uses a simple count query (`.lt("check_in_date", dateTo).gt("check_out_date", dateFrom)`) which counts any reservation overlapping the range. This has two problems:
1. For multi-day ranges, different days may have different availability but only one number is returned
2. A reservation checking out within the range is counted as fully occupying it, even though checkout day is free

**Fix**: Rewrite `calculateAvailability` to do day-by-day calculation (matching the full-sync logic where `check_out_date > date` excludes the checkout day), then collapse consecutive days with the same availability into ranges. Update the caller to push multiple availability values per queue item.

The full-sync function (`channex-full-sync/index.ts`) already correctly uses `r.check_out_date > ds` for day-by-day, so no change needed there.

### Changes

**1. SQL Migration — Update trigger function**

Replace `notify_channex_availability_change()` to:
- On UPDATE: if dates or unit changed, queue sync for OLD dates AND NEW dates separately
- On UPDATE: if status changed to 'cancelled', queue sync for the reservation's dates (to restore availability)
- On DELETE: queue sync for OLD dates (already works, no change)
- On INSERT: queue sync for NEW dates (already works, no change)

**2. Edge function — `supabase/functions/channex-process-sync-queue/index.ts`**

Rewrite `calculateAvailability()` → `calculateAvailabilityRanges()`:
- Accept the same parameters but return an array of `{ date_from, date_to, availability }` collapsed ranges
- Fetch all units + reservations + blocked dates for the room type (scoped by property)
- Iterate day-by-day through the date range
- For each day, count occupied units (where `check_in_date <= day AND check_out_date > day`) and blocked units
- Collapse consecutive days with equal availability into ranges (like full-sync does)

Update the availability processing loop (lines 95-146):
- Call `calculateAvailabilityRanges()` instead of `calculateAvailability()`
- Push all returned ranges as separate values (not just one)

