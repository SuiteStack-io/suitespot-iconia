

## Fix Check-In Email to Use Booking.com Name

### Issue
The check-in notification email currently displays the internal suite name (e.g., "Large One Bedroom Suite") instead of the guest-facing booking.com name (e.g., "Double Room with Terrace").

### Solution
Update the `send-checkin-notification` edge function to:
1. Include `booking_com_name` in the units query
2. Use `booking_com_name` as the primary room name with fallback to internal `name`

---

### Technical Changes

**File:** `supabase/functions/send-checkin-notification/index.ts`

#### 1. Update the database query to include `booking_com_name`:

```typescript
// Line 33: Change from
.select('*, units(name, unit_number)')
// To
.select('*, units(name, booking_com_name, unit_number)')
```

#### 2. Update the room name variable to prioritize booking.com name:

```typescript
// Line 94: Change from
const unitName = reservation.units?.name || 'Unknown Unit';
// To
const unitName = reservation.units?.booking_com_name || reservation.units?.name || 'Unknown Unit';
```

---

### Result

| Before | After |
|--------|-------|
| Room: Large One Bedroom Suite - Room #509 | Room: Double Room with Terrace - Room #509 |

This aligns with the established naming convention used across the calendar, reservations list, and checkout notifications.

