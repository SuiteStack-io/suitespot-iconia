

## Plan: Change Suite Name to Booking.com Name in Calendar Page Filters

### Goal
Update the unit filter dropdowns on the Calendar page to display the **booking.com name** instead of the internal suite name.

---

### Problem Analysis

Looking at the screenshot, the dropdown shows entries like:
- "#501 - One Bedroom Suite with Balcony"
- "#502 - One Bedroom Suite with Balcony"

However, according to the database:
- Unit 501 has `booking_com_name: "Suite with Terrace"` 
- Unit 502 has `booking_com_name: "Suite with Terrace"`

The expected display should be:
- "#501 - Suite with Terrace"
- "#502 - Suite with Terrace"

The code already uses `booking_com_name || name` fallback logic, so there may be a caching issue or the units data needs to be fetched with the updated column. However, reviewing the code confirms the logic is correct - so the fix is just ensuring consistency across all dropdowns.

---

### Technical Changes

#### File: `src/components/BlockedDatesManager.tsx`

The unit filter dropdown and room selection checkboxes need to verify they're using `booking_com_name || name`:

**Line 541** - Room selection checkbox label (already correct):
```tsx
#{unit.unit_number} - {unit.booking_com_name || unit.name}
```

**Line 633** - Filter dropdown (already correct):
```tsx
#{unit.unit_number} - {unit.booking_com_name || unit.name}
```

The blocked dates list display also shows the unit name. Need to update this to show booking_com_name.

**Line 156** - Group creation uses `units.name` directly from the joined query:
```tsx
unitName: date.units?.name || 'All Rooms',
```

This should be updated to prefer `booking_com_name`:
```tsx
unitName: date.units?.booking_com_name || date.units?.name || 'All Rooms',
```

**Line 100-105** - The query needs to include `booking_com_name`:
```sql
units (
  name,
  unit_number,
  booking_com_name
)
```

#### File: `src/components/RoomCalendar.tsx`

**Lines 685-687** - Room Type filter dropdown (already correct):
```tsx
{[...new Set(units.map(u => u.booking_com_name || u.name))].sort().map(name => (
  <SelectItem key={name} value={name}>{name}</SelectItem>
))}
```

This is already using the correct logic.

---

### Summary of Changes

| File | Location | Change |
|------|----------|--------|
| `BlockedDatesManager.tsx` | Line 100-105 | Add `booking_com_name` to the units join query |
| `BlockedDatesManager.tsx` | Line 156 | Update unitName to prefer booking_com_name |
| `BlockedDatesManager.tsx` | Interface (line 31-34) | Add `booking_com_name` to the units type |

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/BlockedDatesManager.tsx` | Update joined units query to include booking_com_name, update unitName assignment to prefer booking_com_name |

