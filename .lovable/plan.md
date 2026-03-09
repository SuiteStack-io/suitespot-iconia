

## Remove "Next Reservation" Column from Rooms Table

### Changes in `src/pages/Rooms.tsx`

1. **Remove column header** (line 927): Delete the `<th>` for "Next Reservation"
2. **Remove table cell** (lines 1224–1228): Delete the `<TableCell>` rendering `getNextReservation`
3. **Remove helper function** (lines 373–382): Delete `getNextReservation` function

### Files
- `src/pages/Rooms.tsx`: 3 deletions (~15 lines removed)

