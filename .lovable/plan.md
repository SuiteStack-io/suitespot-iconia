

## Plan: Add "Checked Out" Badge Next to Undo Button

### Goal
Add a wide "Checked Out" badge next to the Undo button for reservations that have been checked out in the Today's Departures modal, providing clear visual confirmation of the check-out status.

---

### Technical Changes

#### File: `src/components/Dashboard.tsx`

**Update the Undo button section (lines 1113-1127)**

From:
```tsx
{dialogTitle.includes('Departures') && (reservation.status === 'checked-out' || reservation.status === 'completed') && (
  <Button
    size="sm"
    variant="ghost"
    onClick={(e) => {
      e.stopPropagation();
      handleUndoClick(reservation.id, 'checkout');
    }}
    disabled={updating === reservation.id}
    className="gap-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
  >
    <Undo2 className="h-3 w-3" />
    Undo
  </Button>
)}
```

To:
```tsx
{dialogTitle.includes('Departures') && (reservation.status === 'checked-out' || reservation.status === 'completed') && (
  <>
    <Badge 
      variant="secondary" 
      className="bg-green-100 text-green-800 border-green-300 px-4 py-1"
    >
      Checked Out
    </Badge>
    <Button
      size="sm"
      variant="ghost"
      onClick={(e) => {
        e.stopPropagation();
        handleUndoClick(reservation.id, 'checkout');
      }}
      disabled={updating === reservation.id}
      className="gap-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
    >
      <Undo2 className="h-3 w-3" />
      Undo
    </Button>
  </>
)}
```

---

### Expected Result

**Before:**
| Status | Actions |
|--------|---------|
| checked-out/completed | [Undo button only] |

**After:**
| Status | Actions |
|--------|---------|
| checked-out/completed | [Checked Out badge] [Undo button] |

---

### Visual Design
- Wide badge with `px-4 py-1` for increased padding
- Green styling (`bg-green-100 text-green-800 border-green-300`) to indicate success/completion
- Positioned directly before the Undo button in the flex container

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/Dashboard.tsx` | Add "Checked Out" badge before Undo button in departures view (lines 1113-1127) |

