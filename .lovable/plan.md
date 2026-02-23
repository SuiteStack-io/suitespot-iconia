

## Fix: RoomRates crash on undefined array properties

### Root Cause

The render method accesses `.length` directly on `room.photos`, `room.features`, and `room.channelRates` without null guards. If any unit in the database has `null` for `photos` or `features`, the cast `(unit.photos as string[])` produces `null` (not `undefined`), and while `|| []` should catch it, there may be edge cases where the grouped data ends up with undefined arrays -- especially if a room type entry is created via the `else` branch but never gets its arrays replaced.

### Fix (3 lines changed in `src/pages/front-desk/RoomRates.tsx`)

1. **Line 179**: Change `room.photos.length > 0` to `room.photos?.length > 0`
2. **Line 222**: Change `room.channelRates.length > 0` to `room.channelRates?.length > 0`
3. **Line 254**: Change `room.features.length > 0` to `room.features?.length > 0`

These are safe no-op changes -- if the arrays are properly populated, the behavior is identical. If they happen to be `undefined`, the page renders gracefully instead of crashing.

### Technical Details

No new files, no database changes. Single file edit with 3 optional chaining additions.
