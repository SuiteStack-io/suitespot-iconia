

## Why Channex Bookings Don't Appear on the Calendar

### Root Cause
The booking `1cbb936b...` was processed by the **old version** of the webhook — before the reservation-creation code was added. The sync log confirms no `reservation` field in the response. The `channex_bookings` table has the record, but the `reservations` table has zero Channex entries.

### Fix: Add a Backfill Function + Ensure Deployment

**1. Redeploy the edge function**
The updated `channex-booking-webhook/index.ts` (already in the repo) needs to be deployed so future bookings create reservations automatically.

**2. Create a backfill edge function** (`sync-channex-to-reservations`)
A one-time/on-demand function that:
- Queries all `channex_bookings` records that have NO matching `reservations` record (by `channex_booking_id`)
- For each unsynced booking:
  - Resolves the room type via `channex_mappings` → `units.booking_com_name`
  - Allocates an available unit using `check_and_lock_unit_availability` RPC
  - Creates a reservation with `skip_channex_sync: true`
- Returns a summary of created/failed reservations

**3. Add a "Sync Missing Bookings" button** on the Channex Integration page
A simple button that invokes the backfill function, with a toast showing results.

### Files to Create/Modify
- `supabase/functions/sync-channex-to-reservations/index.ts` — new backfill edge function
- `supabase/config.toml` — add `verify_jwt = false` for the new function
- `src/components/channex/ConnectionStatus.tsx` or equivalent — add sync button (will check which component is appropriate)

### Alternative (Simpler)
Instead of a new edge function, we could run a direct SQL backfill via migration for the one existing booking, and rely on the redeployed webhook for future bookings. This is faster but less reusable.

