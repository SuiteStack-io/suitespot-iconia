

## Fix: Availability Sync Sends 0 Instead of Actual Unit Count

### Root Cause

`addToPendingAvailabilitySync` uses `setUnits(currentUnits => { ... return currentUnits })` to read the latest units. But `fetchUnits()` also calls `setUnits(data)`. Since both are batched by React, `currentUnits` inside the callback still holds the **old** state (before the new units were inserted). The count is therefore wrong — likely 0 or the old count.

### Fix

Replace the `setUnits` trick with a direct database query to count units. This guarantees we read the committed data after insert.

**File: `src/pages/Rooms.tsx`** — rewrite `addToPendingAvailabilitySync`:

```typescript
const addToPendingAvailabilitySync = async (bookingComName: string) => {
  if (!propertyId) return;

  // Query DB directly for accurate count (units were just inserted)
  const { data: matchingUnits } = await supabase
    .from('units')
    .select('id')
    .eq('property_id', propertyId)
    .eq('booking_com_name', bookingComName)
    .neq('status', 'maintenance');

  const newCount = matchingUnits?.length || 0;
  const anyUnitId = matchingUnits?.[0]?.id;

  if (anyUnitId) {
    setPendingAvailabilitySync(prev => {
      const filtered = prev.filter(p => p.bookingComName !== bookingComName);
      return [...filtered, {
        id: crypto.randomUUID(),
        bookingComName,
        unitId: anyUnitId,
        newCount,
      }];
    });
  }
};
```

Also update the two call sites to `await` the now-async function:
- Line ~632: `await addToPendingAvailabilitySync(addedBookingComName);`
- Line ~757: `await addToPendingAvailabilitySync(clonedBookingComName);`

No other files need changes. The sync payload builder (`handleSyncAvailability`) already correctly uses `p.newCount` — the only problem was that `newCount` was being calculated from stale React state.

