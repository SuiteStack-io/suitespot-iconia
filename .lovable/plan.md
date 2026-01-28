
## Plan: Add Create Reservation Button to Calendar Page

### Changes Required

Add a "Create Reservation" button to the Unit Availability Calendar page, positioned next to the Monthly RevPAR cards on the right side.

---

### Technical Changes

#### File: `src/components/AvailabilityCalendar.tsx`

**1. Add import for CreateReservationDialog (around line 16)**

```tsx
import { CreateReservationDialog } from "./CreateReservationDialog";
```

**2. Modify the metrics cards grid to include the button (lines 1933-1983)**

Change the grid layout to accommodate the new button. The cards grid currently uses:
```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
```

Update to add the Create Reservation button as a third element that aligns to the right:

```tsx
<div className="flex gap-4 mb-4 flex-wrap items-start">
  {/* Occupancy Card */}
  <Card className="p-4 cursor-pointer hover:bg-muted/50 transition-colors flex-1 min-w-[200px] max-w-[300px]">
    ...
  </Card>
  
  {/* RevPAR Card - Admin Only */}
  {userRole === 'admin' && (
    <Card className="p-4 cursor-pointer hover:bg-muted/50 transition-colors flex-1 min-w-[200px] max-w-[300px]">
      ...
    </Card>
  )}
  
  {/* Spacer to push button to right */}
  <div className="flex-1" />
  
  {/* Create Reservation Button */}
  <CreateReservationDialog />
</div>
```

---

### Visual Layout After Changes

```
┌─────────────────────────────────────────────────────────────────────────┐
│  < Previous     January 2026           Weekly View   Next >            │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐              ┌───────────┐ │
│  │ Monthly Occupancy│  │ Monthly RevPAR   │              │+ Create   │ │
│  │ 67.5%            │  │ $71              │              │Reservation│ │
│  │ 220 of 326 nights│  │ Total Rev: $22k  │              └───────────┘ │
│  └──────────────────┘  └──────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/AvailabilityCalendar.tsx` | Add import for CreateReservationDialog, restructure metrics section to include button on right |

---

### Expected Result

- Create Reservation button appears on the same row as the occupancy/RevPAR cards
- Button is positioned on the right side, below the navigation controls
- Button styling matches the dark theme used elsewhere in the app
- Clicking the button opens the CreateReservationDialog modal
