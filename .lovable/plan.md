

## Fix: Remove Invalid `arrival_time` References

### Problem
Two lines in `src/pages/ReservationDetail.tsx` reference `reservation.arrival_time`, which does not exist in the database or TypeScript types, causing build errors.

### Solution
Remove `reservation.arrival_time ||` from both lines. The existing regex fallback that extracts arrival time from the `notes` field will continue to work.

### Changes

| File | Line | Change |
|------|------|--------|
| `src/pages/ReservationDetail.tsx` | 1684 | Remove `reservation.arrival_time ||` from the condition, keep only the regex match |
| `src/pages/ReservationDetail.tsx` | 1704 | Remove `reservation.arrival_time ||` from the display value, keep only the regex match |

No database changes needed. The regex fallback already handles arrival time extraction from notes.

