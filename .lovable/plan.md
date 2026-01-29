
## Plan: Fix Extension Badge Priority Over Check-In Badge

### Problem

In the calendar view, reservations that are extensions (purple EXT badge) are incorrectly showing a green "CHECK IN" badge when the current day matches their `check_in_date`. 

Both badges occupy the same position (`absolute top-0 right-0`), and the CHECK IN badge renders after EXT, causing it to visually override the extension indicator.

**Business Logic:** An extension reservation represents a "continued stay" - the guest is already in-house and simply extending their stay. Showing "CHECK IN" is misleading since no new guest arrival is occurring.

---

### Solution

Modify the badge display logic so that **extension reservations never show the CHECK IN badge**. The EXT badge takes priority.

Change:
```typescript
// Show CHECK IN only if it's check-in day AND not an extension
isCheckIn && !isExtension → show CHECK IN
isExtension → show EXT
```

---

### Technical Changes

#### File: `src/components/AvailabilityCalendar.tsx`

**1. DraggableReservationCell component (lines 147-156)**

Update to prevent showing CHECK IN when extension:

```tsx
// Before (line 152-156)
{isCheckIn && (
  <span className="absolute top-0 right-0 ...">
    CHECK IN
  </span>
)}

// After
{isCheckIn && !isExtended && (
  <span className="absolute top-0 right-0 ...">
    CHECK IN
  </span>
)}
```

**2. Non-draggable reservation cell (lines 2257-2261)**

Apply same fix:

```tsx
// Before
{isSameDay(new Date(reservation.check_in_date), day) && (
  <span className="absolute top-0 right-0 ...">
    CHECK IN
  </span>
)}

// After
{isSameDay(new Date(reservation.check_in_date), day) && !isExtensionReservation(reservation) && (
  <span className="absolute top-0 right-0 ...">
    CHECK IN
  </span>
)}
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/AvailabilityCalendar.tsx` | Add `!isExtended` / `!isExtensionReservation()` condition to CHECK IN badge displays |

---

### Expected Result

Extension reservations will show the **purple EXT badge** on their start date, NOT the green CHECK IN badge. Regular (non-extension) reservations will continue to show the CHECK IN badge on their arrival day.
