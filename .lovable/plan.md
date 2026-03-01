

## Fix: Reservations List not refreshing on property change

### Problem Found
In `src/components/ReservationsList.tsx` (line 203), the main `useEffect` that fetches reservations and units has an empty dependency array `[]`. This means:

1. Data is fetched only once when the component mounts
2. When the active property changes (e.g., switching to ICONIA Zamalek), the list does NOT re-fetch
3. The user may see stale data from the previously active property, or no data at all if `propertyId` wasn't set during the initial mount

The calendar components (`AvailabilityCalendar`, `RoomCalendar`, `Dashboard`) all correctly include `propertyId` in their dependency arrays, so those should be working. The reservations list page is the one with the bug.

### Fix — `src/components/ReservationsList.tsx`

**Line 203**: Add `propertyId` to the dependency array:
```typescript
// Change from:
}, []);
// To:
}, [propertyId]);
```

This is the exact same fix pattern applied to `CreateReservationDialog.tsx` in the previous change.

