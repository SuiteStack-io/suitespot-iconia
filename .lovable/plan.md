
## Remove Room Type Description from Room Selector Dropdown

### Overview

Simplify the room selection dropdown to show only the room name and unit number, removing the description/type suffix (e.g., "1bd Large", "1bd + Balcony").

### Change -- File: `src/components/CreateReservationDialog.tsx`

**Line 1412**: Change the SelectItem display text from:
```
{unit.name}{unit.unit_type ? ` - ${unit.unit_type}` : ''} {unit.unit_number ? `(#${unit.unit_number})` : ''}
```
To:
```
{unit.name} {unit.unit_number ? `(#${unit.unit_number})` : ''}
```

This removes the `unit.unit_type` portion, so items like "Deluxe Suite - 1bd Large (#512)" become "Deluxe Suite (#512)".
