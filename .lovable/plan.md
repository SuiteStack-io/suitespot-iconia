

## Plan: Revert "In-House Now" to Only Show Checked-In Guests

### Overview
Change the "In-House Now" card back to only display guests who have officially checked in (status = 'checked-in'). Guests with 'confirmed' status will not appear, even if their check-in date has passed.

---

### Visual Summary

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  CURRENT BEHAVIOR (after previous change):                                   │
│  ┌──────────────────┐                                                        │
│  │  In-House Now    │                                                        │
│  │        4         │  ← Shows confirmed + checked-in guests                │
│  └──────────────────┘                                                        │
│                                                                              │
│  ↓ CHANGE TO ↓                                                              │
│                                                                              │
│  REVERTED BEHAVIOR:                                                          │
│  ┌──────────────────┐                                                        │
│  │  In-House Now    │                                                        │
│  │        1         │  ← Only shows status='checked-in' guests              │
│  └──────────────────┘                                                        │
│                                                                              │
│  Logic: Only guests who completed the guest form (which triggers             │
│  automatic check-in) will appear in "In-House Now"                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Technical Changes

#### File: `src/components/Dashboard.tsx`

**1. Revert the in-house count query (lines 217-224):**

Current:
```typescript
const { data: inHouse } = await supabase
  .from('reservations')
  .select('id', { count: 'exact' })
  .in('status', ['confirmed', 'checked-in'])
  .lte('check_in_date', today)
  .gt('check_out_date', today)
  .is('cancelled_at', null);
```

Change to:
```typescript
const { data: inHouse } = await supabase
  .from('reservations')
  .select('id', { count: 'exact' })
  .eq('status', 'checked-in')
  .gte('check_out_date', today)
  .is('cancelled_at', null);
```

**2. Revert the dialog query for "In-House Now" (lines 406-414):**

Current:
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

Change to:
```typescript
case 'inhouse':
  setDialogTitle('In-House Now');
  query = query
    .eq('status', 'checked-in')
    .gte('check_out_date', today)
    .is('cancelled_at', null);
  break;
```

---

### Workflow After Both Changes

1. Guest arrives → Appears in "Today's Arrivals" with "Check In (Complete Guest Form)" button
2. Staff clicks button → Opens guest form in new tab
3. Guest completes form → Status automatically changes to "checked-in"
4. Dashboard refreshes → Guest now appears in "In-House Now" card
5. Guests who haven't completed the form remain in "Today's Arrivals" only

---

### Expected Result

- "In-House Now" only shows guests with status = 'checked-in'
- Completing the guest form is required to appear in "In-House Now"
- This enforces the check-in workflow through the guest form

