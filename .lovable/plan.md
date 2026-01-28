

## Plan: Fix "In-House Now" Card to Show Currently Staying Guests

### Problem Identified
The "In-House Now" card only shows reservations with `status = 'checked-in'`, but several guests are physically in-house without their status being updated:

| Room | Guest | Status | Should Show? |
|------|-------|--------|--------------|
| 511 | rawan tarabzoni | confirmed | Yes (check-in was Jan 27) |
| 518 | Mounira Elbalawy | checked-in | Yes |
| 417/418 | H RRR | confirmed | Yes (check-in was Jan 24) |
| 503 | Abraham Waxler | confirmed | Yes (check-in was Jan 26) |

---

### Visual Summary

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  CURRENT BEHAVIOR:                                                           │
│  ┌──────────────────┐                                                        │
│  │  In-House Now    │                                                        │
│  │        1         │  ← Only counts status='checked-in'                    │
│  └──────────────────┘                                                        │
│                                                                              │
│  ↓ CHANGE TO ↓                                                              │
│                                                                              │
│  FIXED BEHAVIOR:                                                             │
│  ┌──────────────────┐                                                        │
│  │  In-House Now    │                                                        │
│  │        4         │  ← Counts all guests currently staying                │
│  └──────────────────┘     (check_in_date <= today AND check_out_date > today)│
│                                                                              │
│  When clicked, shows:                                                        │
│  - Room 511: rawan tarabzoni                                                │
│  - Room 518: Mounira Elbalawy                                               │
│  - Room 417/418: H RRR                                                       │
│  - Room 503: Abraham Waxler                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Technical Changes

#### File: `src/components/Dashboard.tsx`

**1. Update the in-house count query (lines 217-223):**

Current (incorrect):
```typescript
const { data: inHouse } = await supabase
  .from('reservations')
  .select('id', { count: 'exact' })
  .eq('status', 'checked-in')  // ← Only counts checked-in
  .gte('check_out_date', today)
  .is('cancelled_at', null);
```

Change to (correct):
```typescript
// In-house: guests currently staying (check_in_date <= today AND check_out_date > today)
const { data: inHouse } = await supabase
  .from('reservations')
  .select('id', { count: 'exact' })
  .in('status', ['confirmed', 'checked-in'])  // Include confirmed guests who should be in-house
  .lte('check_in_date', today)  // Check-in date has passed or is today
  .gt('check_out_date', today)  // Check-out date is in the future
  .is('cancelled_at', null);
```

**2. Update the dialog query for "In-House Now" (lines 407-411):**

Current:
```typescript
case 'inhouse':
  setDialogTitle('In-House Now');
  query = query.eq('status', 'checked-in').gte('check_out_date', today).is('cancelled_at', null);
  break;
```

Change to:
```typescript
case 'inhouse':
  setDialogTitle('In-House Now');
  query = query
    .in('status', ['confirmed', 'checked-in'])
    .lte('check_in_date', today)
    .gt('check_out_date', today)
    .is('cancelled_at', null);
  break;
```

---

### Logic Explanation

A guest is "In-House Now" if:
1. Their check-in date is today or earlier (`check_in_date <= today`)
2. Their check-out date is tomorrow or later (`check_out_date > today`)
3. Status is either 'confirmed' or 'checked-in' (not cancelled/completed)
4. Reservation is not soft-deleted (`cancelled_at IS NULL`)

This matches the real-world scenario where guests arrive even if staff hasn't updated the status.

---

### Expected Result

After implementation:
- Card shows "4" instead of "1"
- Clicking the card shows all 4 rooms: 511, 518, 417/418, 503
- Includes guests whose status hasn't been updated yet by front desk
- Still excludes cancelled reservations

