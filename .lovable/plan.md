

## Plan: Make Title Headers Sticky in Dashboard Card Modals

### Current State

Looking at the Dashboard page, there are several modals that open when clicking on dashboard cards:

| Modal | Current Implementation | Needs Sticky Header |
|-------|----------------------|---------------------|
| Today's Arrivals / Departures / In-House / etc. | Already has sticky header | No change needed |
| Occupancy Breakdown Modal | Header scrolls with content | Yes |
| RevPAR Breakdown Modal | Header scrolls with content | Yes |

The main reservation list modal (Today's Arrivals, Departures, In-House, New Bookings, Cancellations, Transfers) already has the sticky header pattern correctly implemented.

### Solution

Apply the same sticky header pattern used in the main Dashboard dialog to the Occupancy and RevPAR breakdown modals in the AvailabilityCalendar component.

---

### Technical Changes

#### File: `src/components/AvailabilityCalendar.tsx`

**1. Occupancy Breakdown Modal (lines 2558-2607)**

Update DialogContent and DialogHeader structure:

```tsx
// Before
<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
  <DialogHeader>
    <DialogTitle>...</DialogTitle>
  </DialogHeader>
  {/* content */}
</DialogContent>

// After
<DialogContent className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
  <DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b shrink-0 pr-8">
    <DialogTitle>...</DialogTitle>
  </DialogHeader>
  <div className="overflow-y-auto flex-1 pt-4 space-y-4">
    {/* Summary and Table content moved here */}
  </div>
</DialogContent>
```

**2. RevPAR Breakdown Modal (lines 2610-2678)**

Apply the same pattern:

```tsx
// Before
<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
  <DialogHeader>
    <DialogTitle>...</DialogTitle>
  </DialogHeader>
  {/* content */}
</DialogContent>

// After
<DialogContent className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
  <DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b shrink-0 pr-8">
    <DialogTitle>...</DialogTitle>
  </DialogHeader>
  <div className="overflow-y-auto flex-1 pt-4 space-y-4">
    {/* Summary and Table content moved here */}
  </div>
</DialogContent>
```

---

### Sticky Header Pattern Explained

The pattern involves:
1. `DialogContent` uses `flex flex-col overflow-hidden` to create a flex container that clips overflow
2. `DialogHeader` uses `sticky top-0 bg-background z-10 shrink-0 pr-8 border-b` to stay fixed at top
3. Content is wrapped in a `div` with `overflow-y-auto flex-1` to create the scrollable area
4. `pr-8` ensures the header background covers the area where the X close button sits

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/AvailabilityCalendar.tsx` | Update Occupancy and RevPAR modals with sticky header pattern |

---

### Expected Result

When scrolling through long lists of units in the Occupancy or RevPAR breakdown modals, the title header ("Weekly/Monthly Occupancy Breakdown" or "Weekly/Monthly RevPAR Breakdown") will remain visible at the top, along with the X close button.

