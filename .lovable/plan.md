

## Fix: Remove explicit `nights` from inserts/updates

### Root Cause
The `nights` column on the `reservations` table is a **generated column** (computed as `check_out_date - check_in_date`). Both the `channex-booking-webhook` and `sync-channex-to-reservations` edge functions try to explicitly set `nights`, which Postgres rejects with `"cannot insert a non-DEFAULT value into column 'nights'"`.

### Fix

**1. `supabase/functions/channex-booking-webhook/index.ts`**
- Remove `nights: calculateNights(...)` from the insert record (~line 347)
- Remove `nights: calculateNights(...)` from the update call (~line 267)
- The `calculateNights` helper function can be removed entirely

**2. `supabase/functions/sync-channex-to-reservations/index.ts`**
- Remove `nights` from the insert record (~line 150)
- Remove the `calculateNights` helper function

### Result
After these changes, the backfill function will successfully create reservations for the 2 existing Channex bookings, and future webhook calls will also work. The `nights` value will be auto-computed by Postgres.

### Files Modified
- `supabase/functions/channex-booking-webhook/index.ts`
- `supabase/functions/sync-channex-to-reservations/index.ts`

