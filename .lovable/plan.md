

## Fix: Cloned Room Missing `property_id` and `booking_com_name`

### Problem
The `handleConfirmClone` function in `src/pages/Rooms.tsx` (line 633-650) builds `clonedData` but omits `property_id` and `booking_com_name`. Without `property_id`, the new room doesn't match the active property filter, so it never appears in the list despite being successfully inserted.

### Fix
In `src/pages/Rooms.tsx`, add `property_id` and `booking_com_name` to the `clonedData` object (around line 633):

```typescript
const clonedData = {
  name: roomToClone.name,
  unit_number: newRoomNumber,
  unit_type: roomToClone.unit_type,
  unit_size: roomToClone.unit_size,
  status: 'available',
  booking_com_id: null,
  booking_com_name: roomToClone.booking_com_name,  // ADD
  comments: roomToClone.comments,
  beds: roomToClone.beds,
  baths: roomToClone.baths,
  max_guests: roomToClone.max_guests,
  sofa_bed: roomToClone.sofa_bed,
  price_per_night: roomToClone.price_per_night,
  weekend_rate: roomToClone.weekend_rate,
  tax_percentage: roomToClone.tax_percentage,
  photos: roomToClone.photos || [],
  view: roomToClone.view,
  property_id: propertyId || roomToClone.property_id,  // ADD - critical fix
  count_of_rooms: roomToClone.count_of_rooms,           // ADD
  default_occupancy: roomToClone.default_occupancy,     // ADD
  max_children: roomToClone.max_children,               // ADD
  max_infants: roomToClone.max_infants,                 // ADD
  room_kind: roomToClone.room_kind,                     // ADD
  location: roomToClone.location,                       // ADD
  features: roomToClone.features || [],                 // ADD
  min_stay: roomToClone.min_stay,                       // ADD
};
```

### Root Cause
`property_id` was not included in the clone payload. The `fetchUnits` function uses `withPropertyFilter` which filters by `property_id`, so the orphaned room was invisible.

### Summary
- 1 file: `src/pages/Rooms.tsx` lines 633-650
- Add `property_id`, `booking_com_name`, and other missing fields to clone data

