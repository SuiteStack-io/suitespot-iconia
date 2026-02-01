
## Fix Housekeeping Email Room Naming

### Issue
The housekeeping cleaning notification email currently displays:
- Internal suite name first, then room number: "Deluxe One Bedroom Suite (#506)"

### Requested Change
Display:
- Room number first, then booking.com name: "Room #506 - Double Room with Terrace"

---

### Technical Changes

**File:** `supabase/functions/send-mid-stay-cleaning-notifications/index.ts`

#### 1. Update database query to include `booking_com_name` (Lines 42-45):

```typescript
// Change from:
units (
  name,
  unit_number
)

// To:
units (
  name,
  booking_com_name,
  unit_number
)
```

#### 2. Update room name formatting in email HTML (Lines 200-209):

```typescript
// Change from:
const unitName = unit?.name || 'Unknown Unit';
const unitNumber = unit?.unit_number || '';
// ...
<strong style="font-size: 16px;">${unitName}${unitNumber ? ` (#${unitNumber})` : ''}</strong>

// To:
const unitName = unit?.booking_com_name || unit?.name || 'Unknown Unit';
const unitNumber = unit?.unit_number || '';
// ...
<strong style="font-size: 16px;">Room #${unitNumber} - ${unitName}</strong>
```

---

### Result

| Before | After |
|--------|-------|
| Deluxe One Bedroom Suite (#506) | Room #506 - Double Room with Terrace |
| One Bedroom Suite with Balcony (#502) | Room #502 - Double Room with Balcony |

This aligns with the check-in/check-out notification format and uses the guest-facing booking.com name.
