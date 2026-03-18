

## Push Availability After Booking Webhook Processing

### Problem
The webhook sets `skip_channex_sync: true` on reservations, so the PMS database trigger never pushes availability back to Channex. With Channex auto-availability being turned off, no availability update happens at all after OTA bookings.

### Solution
Add an availability push block between the ACK section (line 426) and the final `logSync` call (line 428). This handles new, modified, and cancelled bookings.

### Changes

**File: `supabase/functions/channex-booking-webhook/index.ts`**

Insert a new block after line 426 (`}` closing the ACK section) and before line 428 (the final `logSync`):

1. **For modifications** — before updating the reservation (around line 273), first query the existing reservation's `check_in_date` and `check_out_date` and store them as `oldArrivalDate` / `oldDepartureDate`. These will be used later to restore availability on the old date range.

2. **New availability push block** (after ACK, before final logSync):
   - Wrap everything in `try/catch` so failures don't break the webhook response
   - Skip if `isTestProperty` or missing `channexPropertyId`
   - Get the Channex `room_type_id` from `rooms[0].room_type_id` (already available in `enrichedData`)
   - If not available, look it up from `channex_mappings` using `roomTypeId` (local ID)
   - Resolve `booking_com_name` from the local unit to count total units of that room type
   - Build date ranges to update:
     - For **new/modified**: the current booking's `arrival_date` to `departure_date` minus 1 day
     - For **modified**: also the old date range (`oldArrivalDate` to `oldDepartureDate` minus 1 day)
     - For **cancelled**: the cancelled booking's date range
   - For each date range, count overlapping confirmed reservations and calculate `availability = totalUnits - overlapping`
   - Push via `channexRequest("POST", "/api/v1/availability", { values: [...] })`
   - Log the push to `channex_sync_logs`

3. **Old dates capture for modifications** — modify the existing update path (line 267-299) to fetch old dates before updating:
   - Change the existing `select("id")` query on line 268 to `select("id, check_in_date, check_out_date")`
   - Store `oldArrivalDate = existing.check_in_date` and `oldDepartureDate = existing.check_out_date` in variables declared in the outer scope (alongside `reservationResult` on line 240)

4. **Old dates capture for cancellations** — similarly, in the cancel path (line 246-264), change `select("id")` to `select("id, check_in_date, check_out_date")` and store old dates.

### Key details
- Uses `channexRequest` from shared client (already imported)
- Availability = total units with matching `booking_com_name` in property minus confirmed reservations overlapping the date range
- Checkout day excluded from occupancy (matches existing convention)
- `date_to` in the Channex payload = departure_date minus 1 day (inclusive last occupied night)
- `skip_channex_sync: true` remains on reservations — no duplicate pushes from DB triggers
- No duplicate variable declarations — old dates stored in variables declared at the `reservationResult` scope level

