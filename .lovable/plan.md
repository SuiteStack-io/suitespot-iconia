

## Diagnosis: Missing `property_id` on Manual Reservation Insert

### Root Cause (Cause A confirmed)

In `src/components/CreateReservationDialog.tsx`, the `handleSubmit` function (line 1054) builds a `reservationData` object that **does not include `property_id`**. Although `propertyId` is correctly retrieved from the property context via `usePropertyId()` at line 177, it is never passed into the insert payload.

**Result**: The reservation is saved to the database with `property_id = NULL`. The RLS INSERT policy allows this (`property_id IS NULL`), so the insert succeeds silently. However, both the AvailabilityCalendar and ReservationsList use `withPropertyFilter` which adds `.eq('property_id', activePropertyId)` to their SELECT queries — so reservations with NULL `property_id` are excluded from results.

The Channex sync (triggered via webhook/notification after insert) works independently, which is why it appears on Channex but not in the PMS UI.

### Fix

**Single change in `src/components/CreateReservationDialog.tsx`**:

Add `property_id: propertyId` to the `reservationData` object at line 1083 (after `group_id: groupId`).

This ensures:
- The reservation is saved with the correct `property_id` from the active property switcher
- It immediately appears in both the calendar and reservations list (which filter by `property_id`)
- The existing Channex sync flow is unaffected
- No other files need changes

### Validation

Add a guard at the top of `handleSubmit` to prevent submission if no property is selected:

```typescript
if (!propertyId) {
  toast.error('No active property selected.');
  return;
}
```

