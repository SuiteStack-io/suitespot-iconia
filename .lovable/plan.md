

## Fix: Double Room delete blocked by old reservations + show related reservations

### Problem
The delete check at line 825 queries `reservations` where `unit_id = roomToDelete.id` with no status filter. This means even completed, cancelled, or checked-out reservations block deletion. The user also cannot see which reservations are blocking the delete.

### Changes — Single file: `src/pages/Rooms.tsx`

**1. Filter delete check to only active reservations** (line ~825-829)
- Change the query to only check for reservations with status `IN ('confirmed', 'checked-in')` — these are genuinely active bookings that should block deletion.
- Completed, cancelled, and checked-out reservations should not prevent deletion.

**2. Show blocking reservation details in the error toast** (line ~833-838)
- When active reservations exist, fetch their details (guest name, check-in/out dates, booking reference).
- Display this info in the toast description so the user can identify and handle the blocking reservation.
- Format: "Booked by [guest] from [check_in] to [check_out] (Ref: [reference])"

**3. Add a "View Reservation" action** 
- Include the reservation ID in the toast so the user can navigate to it, or add a console.log with the reservation details for immediate visibility.

### What stays the same
- If there ARE active reservations, deletion is still blocked (safety preserved).
- No layout, design, or other page changes.

