
## Fix False Conflict Warning in Modification Mode

### Problem Analysis
When uploading a "Reservation changes" screenshot, the system correctly detects it as a modification and shows the blue comparison alert. However, a false conflict warning still appears because:

1. The edge function (`parse-reservation-screenshot`) parses the screenshot and detects `isModification: true`
2. The edge function then checks for conflicts using `check_reservation_overlap` but **without excluding the existing reservation** (it doesn't know the reservation ID at this point)
3. This sets `blockedUnitWarning: "Unit Family Suite has conflicting reservations"` in the response
4. The frontend displays this warning even though its own `fetchUnitsWithStatus` correctly excludes the existing reservations

### Solution
Clear the `blockedUnitWarning` and room warnings when in modification mode, since:
- The edge function cannot exclude existing reservations (it doesn't have the IDs)
- The frontend's `fetchUnitsWithStatus` already correctly handles conflict detection with exclusions
- Users should rely on the dropdown status badges (which are correct) rather than the stale warning from parsing

---

### Technical Changes

#### File: `src/pages/BookingComReservations.tsx`

**Location: Around line 280-300, after detecting modification mode**

When setting up modification mode, also clear the `blockedUnitWarning` from the parsed data and reset room assignments to use the original reservation's unit:

```typescript
// If exists and this is a modification screenshot
if (existing && existing.length > 0 && data.data.isModification) {
  setIsModificationMode(true);
  setExistingReservationsToUpdate(existing);
  setOriginalReservationData(existing[0]);
  setExistingReservation(null);
  
  // Clear the blockedUnitWarning since the edge function 
  // couldn't exclude the existing reservation during parsing.
  // The frontend's fetchUnitsWithStatus will correctly handle this.
  data.data.blockedUnitWarning = null;
  
  // For multi-room modifications, also clear individual room warnings
  if (data.data.matchedRooms) {
    data.data.matchedRooms = data.data.matchedRooms.map((room: RoomInfo, index: number) => ({
      ...room,
      warning: null,
      status: 'available', // Reset status since we'll rely on fetchUnitsWithStatus
      // Pre-assign the existing unit for this room
      unitId: existing[index]?.unit_id || room.unitId || null
    }));
  }
}
```

**Location: Around line 293-301, update room assignments initialization**

When in modification mode, pre-populate room assignments with the existing reservation's unit IDs:

```typescript
// Initialize room assignments from matched rooms
if (data.data.matchedRooms && data.data.matchedRooms.length > 0) {
  const initialAssignments: RoomAssignment[] = data.data.matchedRooms.map((room: RoomInfo, index: number) => ({
    roomIndex: index,
    roomName: room.roomName,
    price: room.price,
    // In modification mode, use the existing reservation's unit
    unitId: (data.data.isModification && existing && existing[index]) 
      ? existing[index].unit_id 
      : (room.unitId || null)
  }));
  setRoomAssignments(initialAssignments);
}
```

---

### Result

| Before | After |
|--------|-------|
| Family Suite shows "has conflicting reservations" warning | Warning is cleared in modification mode |
| Room dropdown has no pre-selected value | Pre-selects the existing reservation's assigned room |
| User must manually select room again | Room stays assigned, user can change if needed |

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/BookingComReservations.tsx` | Clear `blockedUnitWarning` and pre-assign units when in modification mode |
