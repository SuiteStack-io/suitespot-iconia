
## Fix Room Dropdown Display and Modification Conflict Detection

### Issues Identified

1. **Room dropdown shows internal suite names instead of booking.com names**
   - The dropdown displays "Deluxe One Bedroom Suite (#506)" using `unit.name`
   - Should display the guest-facing `booking_com_name` field with fallback to `name`

2. **False conflict detection for Family Suite during reservation modification**
   - When modifying booking 6083546298, the Family Suite shows as "Reserved" because the system detects a conflict with the original reservation being modified
   - The RPC function `check_reservation_overlap` already supports a `p_exclude_id` parameter that we're not using

---

### Technical Changes

#### File 1: `src/pages/BookingComReservations.tsx`

**A. Update `fetchUnitsWithStatus` to include `booking_com_name` (line 175-178)**

```typescript
// Change from:
const { data: allUnits } = await supabase
  .from('units')
  .select('id, name, unit_number, unit_type')
  .eq('location', 'ICONIA')
  .order('name');

// To:
const { data: allUnits } = await supabase
  .from('units')
  .select('id, name, unit_number, unit_type, booking_com_name')
  .eq('location', 'ICONIA')
  .order('name');
```

**B. Update `fetchUnitsWithStatus` to accept and use `excludeReservationIds` parameter (lines 172-218)**

```typescript
// Change function signature from:
const fetchUnitsWithStatus = async (checkIn: string, checkOut: string, excludeUnitIds: string[] = []) => {

// To:
const fetchUnitsWithStatus = async (checkIn: string, checkOut: string, excludeReservationIds: string[] = []) => {
```

Then update the conflict check to exclude the existing reservation IDs:

```typescript
// For each unit, check conflicts excluding the reservations being modified
const { data: conflicts } = await supabase.rpc('check_reservation_overlap', {
  p_unit_id: unit.id,
  p_check_in_date: checkIn,
  p_check_out_date: checkOut,
  p_exclude_id: excludeReservationIds[0] || null  // Exclude first reservation being modified
});
```

For multi-room modifications (multiple reservations with same booking reference), we need to handle excluding all of them:

```typescript
// Filter out conflicts that match any of the excluded reservation IDs
const filteredConflicts = (conflicts || []).filter(
  (c: any) => !excludeReservationIds.includes(c.conflict_id)
);

let status: 'available' | 'reserved' | 'blocked' = 'available';
if (filteredConflicts.length > 0) status = 'reserved';
else if (blockedDates && blockedDates.length > 0) status = 'blocked';
```

**C. Update `unitsWithStatus` type definition (lines 112-118)**

```typescript
// Add booking_com_name to the type:
const [unitsWithStatus, setUnitsWithStatus] = useState<{
  id: string;
  name: string;
  unit_number: string;
  unit_type: string;
  booking_com_name: string | null;  // ADD THIS
  status: 'available' | 'reserved' | 'blocked';
}[]>([]);
```

**D. Pass existing reservation IDs when calling `fetchUnitsWithStatus` (around line 302)**

```typescript
// Change from:
if (data.data?.checkInDate && data.data?.checkOutDate) {
  fetchUnitsWithStatus(data.data.checkInDate, data.data.checkOutDate);
}

// To:
if (data.data?.checkInDate && data.data?.checkOutDate) {
  // In modification mode, exclude the existing reservations from conflict detection
  const excludeIds = (existing && existing.length > 0 && data.data.isModification)
    ? existing.map((r: any) => r.id)
    : [];
  fetchUnitsWithStatus(data.data.checkInDate, data.data.checkOutDate, excludeIds);
}
```

**E. Update all room dropdown display text (multiple locations)**

Replace `unit.name` with `unit.booking_com_name || unit.name` in all SelectItem components:

**Line 1827:**
```typescript
// Change from:
<span>{unit.name} (#{unit.unit_number})</span>

// To:
<span>{unit.booking_com_name || unit.name} (#{unit.unit_number})</span>
```

**Line 1947:**
```typescript
// Change from:
<span>{unit.name} (#{unit.unit_number})</span>

// To:
<span>{unit.booking_com_name || unit.name} (#{unit.unit_number})</span>
```

**Line 2125:**
```typescript
// Change from:
<span>{unit.name} (#{unit.unit_number})</span>

// To:
<span>{unit.booking_com_name || unit.name} (#{unit.unit_number})</span>
```

**F. Also update `fetchAvailabilityForSegment` function (lines 393-443) with same changes:**

- Include `booking_com_name` in select query
- Accept and use `excludeReservationIds` parameter
- Update segment availability type to include `booking_com_name`

---

### Summary of Changes

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Internal suite names in dropdown | Query doesn't fetch `booking_com_name` | Add `booking_com_name` to select query and display it with fallback |
| Family Suite shows Reserved | Conflict check doesn't exclude the reservation being modified | Pass existing reservation IDs to `fetchUnitsWithStatus` and filter conflicts |

---

### Result

- Room dropdowns will show guest-facing booking.com names (e.g., "Double Room with Terrace") instead of internal names
- When modifying an existing reservation, the currently assigned room will show as "Available" instead of "Reserved"
- Other rooms with actual conflicts from different bookings will still correctly show as "Reserved"
