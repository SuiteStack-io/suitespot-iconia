

## Fix: Channex Bookings Not Appearing on Calendar

### Problem
The `channex-booking-webhook` saves incoming bookings only to the `channex_bookings` table. The calendar reads from the `reservations` table. No bridge exists between the two — so Channex bookings never appear on the calendar.

### Solution

**1. Database Migration — Add `channex_booking_id` column to `reservations`**

Add a nullable text column to `reservations` for deduplication and linking:
```sql
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS channex_booking_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_channex_booking_id 
  ON public.reservations(channex_booking_id) WHERE channex_booking_id IS NOT NULL;
```

**2. Update `channex-booking-webhook/index.ts` — Create reservation after saving to `channex_bookings`**

After the existing upsert to `channex_bookings` succeeds, add logic to create/update a `reservations` record:

- **For new/modified bookings:**
  1. Check idempotency: skip if a reservation with this `channex_booking_id` already exists
  2. Resolve the room type: the `roomTypeId` from `channex_mappings` points to a unit ID. Get that unit's `booking_com_name` to find all units of that type
  3. Find an available unit using `check_and_lock_unit_availability` RPC (same pattern as `allocate-unit`)
  4. Calculate nights from arrival/departure dates
  5. Insert into `reservations` with:
     - `channex_booking_id`: the Channex booking ID
     - `booking_reference`: OTA reservation code or Channex booking ID
     - `check_in_date` / `check_out_date`: arrival/departure dates
     - `guest_names`: `[guestName]`
     - `contact_email` / `contact_phone`: from customer data
     - `status`: `'confirmed'`
     - `channel`: `'Channex'` 
     - `source`: OTA name (e.g., "Booking.com")
     - `property_id`: resolved local property ID
     - `unit_id`: allocated unit (or null if none available)
     - `total_price`: amount
     - `currency`: from booking
     - `number_of_guests`: from enriched data (adults + children) or default 1
     - `skip_channex_sync`: `true` (prevent feedback loop — the trigger `notify_channex_availability_change` checks this flag)
  6. If no unit available, create with `status: 'pending_assignment'` and notify admins

- **For cancellations:**
  1. Update the existing reservation's status to `'cancelled'` using `channex_booking_id`

- **For modifications:**
  1. Update existing reservation dates, guest info, and amount using `channex_booking_id`

### Key Details

- The `skip_channex_sync = true` flag is critical — the existing trigger `notify_channex_availability_change` would otherwise push availability back to Channex, creating a loop
- Unit allocation reuses the existing `check_and_lock_unit_availability` RPC for race-condition safety
- The `booking_com_name` field on units groups them by room type — this is how we find all units of a given type when the channex mapping `local_id` points to one specific unit

### Files Modified
- `supabase/functions/channex-booking-webhook/index.ts` — add reservation creation logic after channex_bookings upsert
- Database migration — add `channex_booking_id` column to reservations table

