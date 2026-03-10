

## Fix: Filter Blocked Dates by Active Property

### Problem
`fetchBlockedDates()` fetches ALL blocked dates across all properties. `fetchUnits()` correctly filters by `propertyId`, but blocked dates does not.

### File: `src/components/BlockedDatesManager.tsx`

**1. Filter `fetchBlockedDates` by property (lines 101-121)**

The `blocked_dates` table references `units` via `unit_id`. Filter by joining through units that belong to the active property:

```typescript
const fetchBlockedDates = async () => {
  try {
    let query = supabase
      .from("blocked_dates")
      .select(`
        *,
        units (
          name,
          unit_number,
          booking_com_name
        )
      `)
      .order("blocked_date", { ascending: true });

    // Filter to only show blocked dates for units belonging to the active property
    if (propertyId) {
      query = query.eq('units.property_id', propertyId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Remove entries where the unit was filtered out (unit doesn't belong to property)
    const filtered = (data || []).filter(d => d.unit_id === null || d.units !== null);
    setBlockedDates(filtered);
  } catch (error: any) {
    console.error("Error fetching blocked dates:", error);
    toast.error("Failed to fetch blocked dates");
  }
};
```

However, `blocked_dates` rows with `unit_id = null` (meaning "all rooms") have no unit join to filter on. We need a different approach — filter blocked dates whose `unit_id` is either null OR belongs to a unit in the active property. The cleanest way: use the unit IDs we already fetch.

**Better approach — filter client-side using fetched units:**

Since `fetchUnits` already returns only units for the active property, filter blocked dates to only include those whose `unit_id` is null or matches a fetched unit.

Actually, the simplest and most reliable fix: add `property_id` awareness to the query. Since `blocked_dates` has a `unit_id` FK to `units`, and `units` has `property_id`, we can filter via an inner join or use an `in` filter with the property's unit IDs.

**Revised approach — fetch unit IDs first, then filter:**

```typescript
// In useEffect, ensure both refetch when propertyId changes
useEffect(() => {
  fetchUnits();
  fetchBlockedDates();
}, [propertyId]);
```

In `fetchBlockedDates`, after fetching units (or independently):
- Query units for the active property to get their IDs
- Filter blocked_dates where `unit_id` is in that list

**Simplest implementation:**

1. **Change useEffect (line 80-83)** to depend on `propertyId`
2. **Update `fetchBlockedDates`** to filter by property's unit IDs

```typescript
const fetchBlockedDates = async () => {
  try {
    // First get unit IDs for the active property
    let unitIds: string[] = [];
    if (propertyId) {
      const { data: propUnits } = await supabase
        .from("units")
        .select("id")
        .eq("property_id", propertyId);
      unitIds = (propUnits || []).map(u => u.id);
    }

    let query = supabase
      .from("blocked_dates")
      .select(`*, units (name, unit_number, booking_com_name)`)
      .order("blocked_date", { ascending: true });

    if (propertyId && unitIds.length > 0) {
      // Only show blocked dates for this property's units
      query = query.in("unit_id", unitIds);
    } else if (propertyId && unitIds.length === 0) {
      // Property has no units, show nothing
      setBlockedDates([]);
      return;
    }

    const { data, error } = await query;
    if (error) throw error;
    setBlockedDates(data || []);
  } catch (error: any) {
    console.error("Error fetching blocked dates:", error);
    toast.error("Failed to fetch blocked dates");
  }
};
```

3. **Update useEffect** (line 80-83): add `propertyId` to dependency array

### Summary
- 1 file changed: `src/components/BlockedDatesManager.tsx`
- `fetchBlockedDates` filters by active property's unit IDs
- Re-fetches when property switches
- Blocked dates with `unit_id = null` (all-rooms blocks) won't show unless we decide they should — this matches the expectation that blocks are property-scoped

