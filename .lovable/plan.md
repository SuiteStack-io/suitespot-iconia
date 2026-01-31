

## Plan: Display Booking.com Name in Checkout Email Room Details

### Summary

Update the checkout notification email to display the booking.com name (e.g., "Double Room with Terrace") instead of the internal suite name (e.g., "One Bedroom Suite with Balcony") in the Room Details section.

---

### Current vs Target

| Field | Current | Target |
|-------|---------|--------|
| Room: | One Bedroom Suite with Balcony - Room #505 | Double Room with Terrace - Room #505 |

---

### Technical Changes

#### File: `supabase/functions/send-checkout-notification/index.ts`

**Change 1: Update the units select query (line 49)**

Add `booking_com_name` to the fields fetched from the units table:

```typescript
// Before
.select('*, units(name, unit_number, estimated_cleaning_minutes)')

// After
.select('*, units(name, booking_com_name, unit_number, estimated_cleaning_minutes)')
```

**Change 2: Update unitName variable (line 117)**

Use `booking_com_name` as primary, falling back to `name`:

```typescript
// Before
const unitName = reservation.units?.name || 'Unknown Unit';

// After
const unitName = reservation.units?.booking_com_name || reservation.units?.name || 'Unknown Unit';
```

---

### Result

The email "Room Details" section will now show:
- **Room:** Double Room with Terrace - Room #505

Instead of:
- **Room:** One Bedroom Suite with Balcony - Room #505

This matches the convention used elsewhere in the system where `booking_com_name` is the guest-facing room name.

---

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/send-checkout-notification/index.ts` | Add `booking_com_name` to query and use it for display |

