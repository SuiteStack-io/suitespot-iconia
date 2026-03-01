

## Fix: Filter rooms by active property in Create Reservation dialog

### Problem
The `fetchUnits` function in `CreateReservationDialog.tsx` uses `withPropertyFilter` with `propertyId`, but the `useEffect` that calls it (line 428) has an empty dependency array `[]` (line 451). This means:
1. Units are fetched only once on mount, using whatever `propertyId` was active at that time
2. If the property context changes, the room list is stale and may show rooms from a different property

### Fix — `src/components/CreateReservationDialog.tsx`

**Line 451**: Add `propertyId` to the dependency array of the useEffect that calls `fetchUnits`:
```typescript
// Change from:
}, []);
// To:
}, [propertyId]);
```

This ensures that whenever the active property changes, the units list is re-fetched with the correct property filter, so only rooms belonging to the selected property appear in the dropdown.

