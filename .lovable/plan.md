

## Plan: Display booking_com_name Instead of Suite Name in BlockedDatesManager

### Goal
Change the room dropdown in BlockedDatesManager to display `booking_com_name` (e.g., "Double Room with Terrace") instead of the internal suite name (e.g., "One Bedroom Suite with Balcony").

---

### Technical Changes

#### File: `src/components/BlockedDatesManager.tsx`

**1. Update Unit interface to include booking_com_name (line 18-22)**

From:
```tsx
interface Unit {
  id: string;
  name: string;
  unit_number: string | null;
}
```

To:
```tsx
interface Unit {
  id: string;
  name: string;
  unit_number: string | null;
  booking_com_name?: string | null;
}
```

**2. Update fetchUnits query to select booking_com_name (line 81-85)**

From:
```tsx
const { data, error } = await supabase
  .from("units")
  .select("id, name, unit_number")
```

To:
```tsx
const { data, error } = await supabase
  .from("units")
  .select("id, name, unit_number, booking_com_name")
```

**3. Update checkbox label display (line 540)**

From:
```tsx
#{unit.unit_number} - {unit.name}
```

To:
```tsx
#{unit.unit_number} - {unit.booking_com_name || unit.name}
```

**4. Update filter dropdown display (line 632)**

From:
```tsx
#{unit.unit_number} - {unit.name}
```

To:
```tsx
#{unit.unit_number} - {unit.booking_com_name || unit.name}
```

---

### Expected Result

**Before:**
- #501 - One Bedroom Suite with Balcony
- #506 - Deluxe One Bedroom Suite

**After:**
- #501 - Double Room with Terrace
- #506 - Deluxe Double Room

(Falls back to internal name if booking_com_name is null)

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/BlockedDatesManager.tsx` | Add booking_com_name to interface, query, and 2 display locations |

