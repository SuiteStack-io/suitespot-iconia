

## Fix: Channex Webhook Fallback Matching for Pre-Connection Reservations

### Problem
Cancellations (and modifications) from Channex for reservations created before the Channex connection fail silently because they lack a `channex_booking_id`. The webhook only matches by `channex_booking_id`.

### Solution
Add a `findReservationByFallback` helper function in the webhook that tries multiple matching strategies when `channex_booking_id` lookup returns nothing.

### File: `supabase/functions/channex-booking-webhook/index.ts`

#### 1. Add fallback matching helper (before the main handler or inside the try block)

A helper function `findReservationByFallback` that:
- **Try 1**: Match by `booking_reference` = `ota_reservation_code` (already extracted from revision data), filtered to non-cancelled status and matching `property_id`
- **Try 2**: Fuzzy match by `guest_names` (first guest name contains match) + `check_in_date` + `check_out_date` + source ILIKE `%booking%`, filtered to non-cancelled, matching `property_id`
- Returns the matched reservation row or null

#### 2. Update cancellation logic (lines 262-294)

Current code only does:
```typescript
.eq("channex_booking_id", booking_id)
```

Change to:
- First try existing `channex_booking_id` match
- If no result, call `findReservationByFallback(supabase, ota_reservation_code, guestName, effectiveCheckIn, effectiveCheckOut, localPropertyId)`
- If fallback finds a match:
  - Cancel it (update status to "cancelled", set `cancelled_at`, `skip_channex_sync: true`)
  - Store the `channex_booking_id` on the reservation for future matching
  - Set `reservationResult = "cancelled:<id>"`
  - Capture `oldArrivalDate`/`oldDepartureDate` for availability push

#### 3. Update modification logic (lines 297-351)

Same pattern — after the existing `.eq("channex_booking_id", booking_id)` check returns null:
- Call `findReservationByFallback`
- If found, update the reservation with new data AND set `channex_booking_id` on it
- Set `reservationResult = "updated:<id>"`

#### 4. Handle complete miss (no match at all for cancellations)

If cancellation finds no reservation via any method:
- Send an "unmatched cancellation" alert email via `send-cancellation-notification` with a note that it couldn't be matched
- Log via `createAlert` for visibility

### Key implementation detail

The fallback helper:
```typescript
async function findReservationByFallback(
  supabase, otaReservationCode, guestName, checkIn, checkOut, propertyId
) {
  // Try 1: booking_reference match
  if (otaReservationCode) {
    const { data } = await supabase
      .from("reservations")
      .select("id, check_in_date, check_out_date, unit_id")
      .eq("booking_reference", otaReservationCode)
      .neq("status", "cancelled")
      .maybeSingle();
    if (data) return data;
  }

  // Try 2: guest name + dates + source
  if (guestName && checkIn && checkOut && propertyId) {
    const { data } = await supabase
      .from("reservations")
      .select("id, check_in_date, check_out_date, unit_id")
      .eq("check_in_date", checkIn)
      .eq("check_out_date", checkOut)
      .eq("property_id", propertyId)
      .neq("status", "cancelled")
      .ilike("source", "%booking%");
    // Filter client-side for guest name match
    if (data?.length) {
      const match = data.find(r => 
        r.guest_names?.some(n => n.toLowerCase().includes(guestName.split(" ")[0].toLowerCase()))
      );
      if (match) return match;
      // If only one result for those dates, use it
      if (data.length === 1) return data[0];
    }
  }

  return null;
}
```

### What changes
- 1 file edited (`channex-booking-webhook/index.ts`)
- Adds ~60 lines for fallback helper + integration
- No migration needed
- Existing post-connection bookings unaffected (first try still matches by `channex_booking_id`)
- Matched reservations get `channex_booking_id` stamped for future direct matching
- Availability push and cancellation emails work for fallback-matched reservations
- Unmatched cancellations generate an alert

