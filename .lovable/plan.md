

## Remove Booking.com Room ID from Add Room Modal

### Change
Delete lines 1543–1546 in `src/pages/Rooms.tsx` — the input block for "Booking.com Room ID".

### Safety
- The field remains editable via the inline table row editor, so it can still be set after creation if needed.
- The `newUnit` state already defaults `booking_com_id` to `''`, which gets saved as `null` — no database impact.
- Clone functionality already sets `booking_com_id: null` for cloned rooms.

### Files
- `src/pages/Rooms.tsx`: Remove lines 1543–1546 (the `<div>` block containing the Booking.com Room ID label and input).

