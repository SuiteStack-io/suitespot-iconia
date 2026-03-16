

## Fix: Email Notifications Must Respect Property Access

### Problem
All notification edge functions (check-in, check-out, new booking, cancellation, room shuffle, daily summary) filter recipients only by role and notification toggle preference. They never check `user_property_access`, so users receive emails for properties they have no access to.

### The Fix Pattern
Every notification function needs to:
1. Determine the `property_id` of the reservation/event being notified about
2. Query `user_property_access` to get which users have access to that property
3. Intersect with notification preferences (existing logic)
4. Log skipped users who lack property access

### Functions to Update (6 total)

**1. `send-checkin-notification`**
- Already fetches reservation with unit join — add `reservation.property_id`
- After building the admins list and filtering by `checkin_email`, also fetch `user_property_access` for the reservation's `property_id` and filter: only include users whose `user_id` appears in `user_property_access` for that property
- Log skipped users: `"Skipped [name] — no access to property [property_id]"`

**2. `send-checkout-notification`**
- Same pattern: get `reservation.property_id`, fetch `user_property_access`, filter recipients
- Applies to both admin and housekeeping recipients

**3. `send-reservation-notification`**
- Currently receives `unitId` but not `property_id` — need to look up property_id from the reservation or unit
- Add property access filter after the `new_booking_email` preference filter
- The function also sends a customer confirmation email (to the guest) — that is NOT affected; only the internal staff notification loop needs the property filter

**4. `send-cancellation-notification`**
- Currently receives reservation data but no `property_id` — need to fetch it from the reservation record using `reservation_id`
- Add property access filter after the `cancelled_booking_email` preference filter

**5. `auto-shuffle-rooms` (room shuffle notification)**
- The shuffle function already has the reservation context — extract `property_id` from the reservation being shuffled
- Filter admin email recipients by `user_property_access`

**6. `generate-daily-summary`**
- Currently sends to ALL users with `daily_summary_email = true` for only the default property
- Change `getRecipients()` to accept a `property_id` parameter
- Filter recipients: only users who have that property in `user_property_access`
- This already runs per-property (uses default property), so the filter just needs to scope recipients

### Admin Fallback Logic
For each function, after filtering by `user_property_access`, also include admin-role users who have NO rows at all in `user_property_access` (they get global access by default). If an admin has specific entries in `user_property_access`, only send for those properties.

The check: if `user_property_access` has zero rows for an admin user → include them (global access). If they have 1+ rows → only include them if the notification's property_id is among their rows.

### Callers — Pass property_id
Some callers need to start passing `property_id` to the edge functions:
- `CreateReservationDialog` → pass `property_id` from the reservation
- `ReservationDetail` (cancellation) → pass `property_id`
- `ReservationsList` (bulk cancel) → pass `property_id`
- `BookingComReservations` → pass `property_id`

### No Changes To
- Edit Permissions modal UI
- `user_property_access` table structure
- `user_notification_settings` table structure
- Email content/formatting
- WhatsApp guest messages
- Channex webhook handlers

