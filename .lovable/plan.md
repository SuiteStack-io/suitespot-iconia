

## Fix: Bulk Availability Editor Not Accounting for Blocked Dates

### Root Cause
The block IS being created successfully in `blocked_dates` (confirmed in the database). The bug is in **BulkAvailabilityEditor.tsx** — its "Current availability" calculation only counts units not in maintenance status. It does NOT subtract units that have blocked dates or active reservations for the selected date range.

### Fix: `src/components/pms/BulkAvailabilityEditor.tsx`

Update the `fetchCurrent` function (around line 115) to subtract blocked units and reserved units for the selected date range:

```typescript
const fetchCurrent = async () => {
  setIsLoadingAvailability(true);
  try {
    // Get all non-maintenance units for this room type
    const { data: units } = await supabase
      .from('units')
      .select('id')
      .eq('property_id', propertyId)
      .eq('booking_com_name', selectedRoomType)
      .neq('status', 'maintenance');

    if (cancelled) return;
    const unitIds = units?.map(u => u.id) || [];
    const totalUnits = unitIds.length;

    if (totalUnits === 0 || !dateFrom) {
      setCurrentAvailability(totalUnits);
      setAvailability(totalUnits);
      return;
    }

    const checkDate = format(dateFrom, 'yyyy-MM-dd');

    // Count blocked units on this date
    const { data: blockedData } = await supabase
      .from('blocked_dates')
      .select('unit_id')
      .in('unit_id', unitIds)
      .eq('blocked_date', checkDate);

    // Count reserved units on this date (check_in <= date < check_out)
    const { data: reservedData } = await supabase
      .from('reservations')
      .select('unit_id')
      .in('unit_id', unitIds)
      .in('status', ['confirmed', 'checked-in'])
      .lte('check_in_date', checkDate)
      .gt('check_out_date', checkDate);

    if (cancelled) return;

    const blockedUnitIds = new Set(blockedData?.map(b => b.unit_id) || []);
    const reservedUnitIds = new Set(reservedData?.map(r => r.unit_id) || []);
    // Merge both sets to avoid double-counting
    const unavailableIds = new Set([...blockedUnitIds, ...reservedUnitIds]);

    const available = totalUnits - unavailableIds.size;
    setCurrentAvailability(available);
    setAvailability(available);
  } catch {
    if (!cancelled) setCurrentAvailability(null);
  } finally {
    if (!cancelled) setIsLoadingAvailability(false);
  }
};
```

### What changes
- 1 file edited (`BulkAvailabilityEditor.tsx`)
- The "Current: X rooms" display now reflects actual availability (total units minus blocked dates minus active reservations)
- Late checkout blocks, manual blocks, and reservations all reduce the displayed count
- No database or migration changes needed

### Verification
After fix, setting a late checkout on a unit should cause the Bulk Editor to show one fewer available room for that date.

