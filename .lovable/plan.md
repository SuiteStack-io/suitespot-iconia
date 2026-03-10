

## Fix: Display Channex Booking ID and OTA Reference on Reservation Detail

### Problem
The webhook already correctly saves `channex_booking_id` and uses `ota_reservation_code || booking_id` as `booking_reference` (line 355). The issue is the Reservation Detail page doesn't fetch or display `channex_booking_id`, so for Channex bookings there's no way to see the OTA confirmation code vs the Channex ID separately.

### Changes

**1. `src/pages/ReservationDetail.tsx`**
- Add `channex_booking_id` to the `Reservation` interface
- In the reservation detail display section (around line 929), show the `channex_booking_id` when the channel is "Channex":
  - **Booking Reference**: shows `booking_reference` (which is `ota_reservation_code` or `booking_id`)
  - **Channex ID**: shows `channex_booking_id` (only for Channex bookings)
- The `select('*')` query already fetches all columns including `channex_booking_id`, so no query change needed

This is a UI-only change — ~5 lines added to the interface and ~8 lines added to the display section.

