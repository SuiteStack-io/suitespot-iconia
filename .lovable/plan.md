

## Fix Property Selector on Location & Maps Management

### Problem

The "Select Property" dropdown on the Location & Maps Management page lists every individual room (e.g., "Deluxe Suite (512)", "Junior Suite (503)") instead of the actual property name ("ICONIA Zamalek - Boutique Stay & Wellness Residences"). Since all rooms share the same physical location, the dropdown should show the property -- not each room.

### Solution

Change the page to group units by their `location` field and display a single property entry per location. Since all units currently have `location = "ICONIA"`, the dropdown will show one entry: the property name. The location/amenities management will then apply to ALL units at that location.

Since the `units` table doesn't have a dedicated "property name" field, we'll use a simple mapping: `ICONIA` -> `"ICONIA Zamalek - Boutique Stay & Wellness Residences"`. When a property/location is selected, we pass the first unit's ID to the `LocationManager` and `AmenitiesManager` components (they just need any unit at that location to read/write coordinates).

### Changes

**File: `src/pages/LocationsManagement.tsx`**

1. Change the query to fetch distinct locations: `SELECT DISTINCT location, MIN(id) as id FROM units WHERE location IS NOT NULL GROUP BY location`
2. Replace the unit-level dropdown with a location-level dropdown
3. Display property names using a mapping (e.g., "ICONIA" -> "ICONIA Zamalek - Boutique Stay & Wellness Residences")
4. Pass the representative unit ID to child components

### Technical Details

```text
Current query:
  SELECT id, name, booking_com_name, unit_number, address FROM units ORDER BY name

New approach:
  - Query distinct locations with a representative unit ID
  - Map location codes to display names
  - Show: "ICONIA Zamalek - Boutique Stay & Wellness Residences"
  - Instead of: "Deluxe Suite (512)", "Junior Suite (503)", etc.
```

| File | Change |
|------|--------|
| `src/pages/LocationsManagement.tsx` | Replace unit-level dropdown with location/property-level dropdown |

