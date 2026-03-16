

## Fix: Cancellation/Restore sync should include checkout day

### Problem

The `calculateAvailabilityRanges` loop runs `d < endDate`, so it processes days from `date_from` up to but NOT including `date_to`. For creates/modifies, the trigger enqueues `date_to = check_out_date`, so the loop correctly excludes the checkout day (last processed = check_out - 1). The Channex payload then has inclusive `date_to = check_out - 1`. This is correct.

For cancellations and old-range restores, we want to ALSO cover the checkout day itself to clean up any stale reduced availability from older buggy syncs. Currently the trigger enqueues the same `check_out_date`, so the checkout day never gets recalculated.

### Fix: SQL trigger only

Modify `notify_channex_availability_change()` to enqueue `date_to = check_out_date + 1 day` for restore/cleanup scenarios. This makes the loop include the checkout day, which will show full availability (no reservation occupies it).

**Changes in the trigger function (migration):**

1. **DELETE** (line 24): `v_date_to := OLD.check_out_date + interval '1 day';`
2. **Cancellation** (line 101): `OLD.check_out_date + interval '1 day'` instead of `OLD.check_out_date`
3. **Update old range** (line 134): `OLD.check_out_date + interval '1 day'` instead of `OLD.check_out_date`

INSERT and UPDATE new range remain unchanged — they correctly use `check_out_date` (loop excludes checkout day, Channex date_to = last occupied night).

No changes to `channex-process-sync-queue/index.ts`. The processing logic is already correct.

