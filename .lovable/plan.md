
## Plan: Remove Check Out Button from Today's Arrivals Card

### Overview
Remove the "Check Out" button that appears for checked-in guests in the Today's Arrivals modal. Keep the "Form Done" badge and "Undo" button intact.

---

### Current Behavior
When a guest is checked-in on Today's Arrivals card, the following actions are shown:
- ✅ "Form Done" badge (or "Guest Form" button)
- ❌ "Check Out" button (to be removed)
- ✅ "Undo" button

### Desired Behavior
- ✅ "Form Done" badge (or "Guest Form" button)
- ✅ "Undo" button
- No "Check Out" button on Arrivals (Check Out should only appear on Departures)

---

### Technical Changes

#### File: `src/components/Dashboard.tsx`

**Modify the checked-in status action buttons (lines 1026-1065)**

The current code shows the Check Out button for ALL checked-in reservations:

```tsx
{reservation.status === 'checked-in' && (
  <>
    {/* Form Done badge or Guest Form button */}
    {reservation.check_in_agreements && reservation.check_in_agreements.length > 0 ? (
      <Badge>Form Done</Badge>
    ) : (
      <Button>Guest Form</Button>
    )}
    
    {/* Check Out button - shows for ALL modals */}
    <Button>Check Out</Button>  // ← Remove this from Arrivals only
  </>
)}
```

**Change to conditionally hide Check Out on Arrivals:**

```tsx
{reservation.status === 'checked-in' && (
  <>
    {/* Form Done badge or Guest Form button */}
    {reservation.check_in_agreements && reservation.check_in_agreements.length > 0 ? (
      <Badge>Form Done</Badge>
    ) : (
      <Button>Guest Form</Button>
    )}
    
    {/* Check Out button - only show on Departures and In-House, NOT Arrivals */}
    {!dialogTitle.includes('Arrivals') && (
      <Button>Check Out</Button>
    )}
  </>
)}
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/Dashboard.tsx` | Wrap Check Out button (lines 1050-1063) with condition `!dialogTitle.includes('Arrivals')` |

---

### Expected Result
- Today's Arrivals modal: Shows "Form Done" badge and "Undo" button for checked-in guests (no Check Out)
- Today's Departures modal: Shows "Check Out" button as before
- In-House Now modal: Shows "Check Out" button as before
