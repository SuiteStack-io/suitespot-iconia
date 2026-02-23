

## Fix: Integrate Auto-Shuffle into Screenshot Parser

### Problem

The auto-shuffle system was integrated into the `allocate-unit` edge function, but the Booking.com screenshot upload flow uses a different function: `parse-reservation-screenshot`. This function has its own unit-matching logic that simply gives up when no unit is directly available -- it never calls the auto-shuffle.

From the logs:
```
No available matching unit found for room: Deluxe Suite, will require manual assignment
```

### Solution

Add auto-shuffle integration to `parse-reservation-screenshot`. When the simple unit-matching loop finds no available unit for a room (line 272), call `auto-shuffle-rooms` before giving up.

### Changes

| File | Change |
|------|--------|
| `supabase/functions/parse-reservation-screenshot/index.ts` | After the unit-matching loop fails (line 272), invoke `auto-shuffle-rooms` with the room type, dates, and booking reference. If the shuffle succeeds, use the freed unit as the assigned unit for that room. |

### Technical Details

After line 272 (`if (!matchedRoom.unitId && matchingUnits.length > 0)`), add:

1. Get the `booking_com_name` from the first matching unit (this is the room type key used by the shuffle system)
2. Call `supabase.functions.invoke('auto-shuffle-rooms', { body: { roomType, checkInDate, checkOutDate, bookingReference, guestNames, triggerSource: 'allocate-unit' } })`
3. If the shuffle returns `success: true` with a `freedUnitId`:
   - Set `matchedRoom.unitId = freedUnitId`
   - Set `matchedRoom.matchedUnitName = freedUnitNumber`
   - Set `matchedRoom.status = 'available'`
   - Add the freed unit ID to `usedUnitIds` to prevent duplicate assignment
4. If the shuffle fails, fall through to the existing "manual assignment" path

This is a small, focused change -- roughly 20 lines added to the existing function.
