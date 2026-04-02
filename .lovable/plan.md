

## Fix: Add Email Notifications to Channex Booking Webhook

### Problem
The `channex-booking-webhook` edge function creates, modifies, and cancels reservations but never calls any email notification functions. Manual reservation management triggers these emails, but the webhook path bypasses them entirely.

### Root Cause
The webhook writes directly to the database and never invokes `send-reservation-notification`, `send-modification-notification`, or `send-cancellation-notification` edge functions.

### Fix
**File: `supabase/functions/channex-booking-webhook/index.ts`**

Add three notification blocks after the reservation operations (around line 464, after the reservation try/catch block but before the ACK section):

**1. New booking notification** (when `reservationResult` starts with `created:`):
- Fetch the created reservation + unit details from DB
- Invoke `send-reservation-notification` with the same payload shape the manual flow uses:
  - `reservationId`, `guestNames`, `checkIn`, `checkOut`, `unitName`, `unitId`, `unitType`, `totalPrice`, `numberOfGuests`, `adults`, `children`, `source`, `notes`, `guestNationality`, `customerEmail`, `customerPhone`

**2. Modified booking notification** (when `reservationResult` starts with `updated:`):
- Fetch the updated reservation + unit details
- Invoke `send-modification-notification` with:
  - `booking_reference`, `guest_names`, `room_name`, `room_number`, `old_check_in`, `old_check_out`, `new_check_in`, `new_check_out`, `old_total_price`, `new_total_price`, `currency`, `channel`, `source`, `property_id`
- Uses `oldArrivalDate`/`oldDepartureDate` (already captured) for old dates

**3. Cancelled booking notification** (when `reservationResult` starts with `cancelled:`):
- Fetch the cancelled reservation + unit details
- Invoke `send-cancellation-notification` with:
  - `reservation_id`, `booking_reference`, `guest_names`, `check_in_date`, `check_out_date`, `nights`, `total_price`, `currency`, `channel`, `source`, `unit_name`, `unit_number`, `property_id`

### Implementation details
- All notification calls are wrapped in try/catch so a notification failure never blocks the webhook response or ACK
- Each call uses `fetch()` to the edge function URL with service role auth (same pattern as existing `auto-assign-rooms` call)
- The notifications are fired AFTER the reservation DB operation succeeds but BEFORE the Channex ACK
- No new templates — uses the exact same edge functions and email templates as manual reservations
- The `catch` at line 681 needs `(_e)` parameter (existing bug, same fix as before)

### Summary
- 1 file edited: `channex-booking-webhook/index.ts`
- ~60 lines added (3 notification blocks)
- No new edge functions, no new templates, no database changes

