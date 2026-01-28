

## Plan: Merge Check-In and Guest Form Buttons

### Overview
Replace the separate "Guest Form" and "Check In" buttons with a single wide button that requires completing the guest check-in form to officially check in a guest. The existing `GuestCheckIn.tsx` already handles the automatic status change from "confirmed" to "checked-in" upon form submission.

---

### Visual Summary

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  CURRENT LAYOUT (Today's Arrivals - confirmed status):                       │
│                                                                              │
│  ┌─────────────┐  ┌──────────────┐                                          │
│  │ Guest Form  │  │   Check In   │   ← Two separate buttons                 │
│  └─────────────┘  └──────────────┘                                          │
│                                                                              │
│  ↓ CHANGE TO ↓                                                              │
│                                                                              │
│  NEW LAYOUT (merged button):                                                 │
│  ┌────────────────────────────────────────────┐                              │
│  │  ✓ Check In (Complete Guest Form)          │   ← Single wide button      │
│  └────────────────────────────────────────────┘                              │
│                                                                              │
│  When clicked: Opens guest check-in form in new tab                          │
│  Upon form completion: Status auto-updates to "checked-in"                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Technical Changes

#### File: `src/components/Dashboard.tsx`

**Replace buttons for "confirmed" status in Arrivals dialog (lines 997-1025):**

Current code:
```tsx
{reservation.status === 'confirmed' && dialogTitle.includes('Arrivals') && (
  <>
    <Button size="sm" variant="outline" onClick={...}>
      <FileSignature className="h-3 w-3" />
      Guest Form
    </Button>
    <Button size="sm" onClick={...}>
      <CheckCircle className="h-3 w-3" />
      Check In
    </Button>
  </>
)}
```

Change to:
```tsx
{reservation.status === 'confirmed' && dialogTitle.includes('Arrivals') && (
  <Button
    size="sm"
    onClick={(e) => {
      e.stopPropagation();
      window.open(`/guest-checkin/${reservation.id}`, '_blank');
    }}
    className="gap-1 w-full sm:w-auto min-w-[200px]"
  >
    <CheckCircle className="h-3 w-3" />
    Check In (Complete Guest Form)
  </Button>
)}
```

---

### Existing Auto Check-In Logic (No Changes Needed)

The `GuestCheckIn.tsx` already handles the automatic status update:

```typescript
// Lines 297-309 in GuestCheckIn.tsx
const { error: statusError } = await supabase
  .from('reservations')
  .update({ 
    status: 'checked-in',
    checked_in_at: new Date().toISOString()
  })
  .eq('id', reservationId);
```

This means when a guest completes the form:
1. Check-in agreement is saved to the database
2. Reservation status automatically changes to "checked-in"
3. Notification is sent to all admins
4. Dashboard will reflect the new status on refresh

---

### Workflow After Implementation

1. Guest arrives → Reservation shows in "Today's Arrivals" with `confirmed` status
2. Staff clicks "Check In (Complete Guest Form)" → Opens guest form in new tab
3. Guest/staff completes form → Status auto-updates to "checked-in"
4. Dashboard refreshes → Guest now shows:
   - "Form Done" badge (green)
   - "Check Out" button
   - Appears in "In-House Now" card

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/Dashboard.tsx` | Replace two buttons (Guest Form + Check In) with single merged button for confirmed reservations in Arrivals dialog |

