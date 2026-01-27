

## Plan: Add "booking.com" Badge to Calendar Reservation Cells

### Overview
Add a dark blue "booking.com" badge in the bottom-right corner of calendar cells for reservations that came from Booking.com. This provides instant visual identification of the booking source.

---

### Visual Summary

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  CURRENT CELL:                                                               │
│  ┌────────────────────┐                                                      │
│  │  [CHECK IN]        │  ← Top-right badge (EXT or CHECK IN)                │
│  │    Nevine          │                                                      │
│  │    Abadir          │                                                      │
│  └────────────────────┘                                                      │
│                                                                              │
│  ↓ CHANGE TO ↓                                                              │
│                                                                              │
│  NEW CELL (for Booking.com reservations):                                    │
│  ┌────────────────────┐                                                      │
│  │  [CHECK IN]        │  ← Top-right (existing)                             │
│  │    Nevine          │                                                      │
│  │    Abadir          │                                                      │
│  │      [booking.com] │  ← NEW: Bottom-right, dark blue badge               │
│  └────────────────────┘                                                      │
│                                                                              │
│  Badge Design:                                                               │
│  • Dark blue background (#003580 - Booking.com brand color)                 │
│  • White text "booking.com"                                                  │
│  • Font size: 6px                                                            │
│  • Position: absolute bottom-0 right-0                                       │
│  • Rounded corners (rounded-tl)                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Technical Changes

#### Helper Function
Create a helper to detect Booking.com source:

```typescript
const isBookingComSource = (source: string | undefined): boolean => {
  return source?.toLowerCase().includes('booking') || false;
};
```

---

### Files to Modify

#### 1. `src/components/AvailabilityCalendar.tsx`

**Locations to update:**

| Component/Section | Line Range | Change |
|-------------------|------------|--------|
| `DraggableReservationCell` | ~144-163 | Add badge after guest name display |
| Non-draggable reservation cell | ~2228-2247 | Add badge after guest name display |
| `SplitTurnoverCell` (arriving guest section) | ~193-196 | Add small badge indicator |
| Checkout-only cell (departing guest section) | ~2191-2194 | Add badge for departing Booking.com guest |

**Implementation for `DraggableReservationCell` (~line 162):**

```tsx
<div className="flex flex-col items-center justify-center h-full px-1 overflow-hidden relative">
  {/* Existing EXT badge */}
  {isExtended && (
    <span className="absolute top-0 right-0 text-[6px] bg-purple-500 text-white px-0.5 rounded-bl font-semibold leading-tight">
      EXT
    </span>
  )}
  {/* Existing CHECK IN badge */}
  {isCheckIn && (
    <span className="absolute top-0 right-0 text-[6px] bg-emerald-600 text-white px-0.5 rounded-bl font-semibold leading-tight">
      CHECK IN
    </span>
  )}
  {/* Guest name display */}
  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium text-center leading-tight">
    {firstName}
  </span>
  {lastName && (
    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium text-center leading-tight">
      {lastName}
    </span>
  )}
  {/* NEW: Booking.com badge */}
  {reservation.source?.toLowerCase().includes('booking') && (
    <span className="absolute bottom-0 right-0 text-[6px] bg-[#003580] text-white px-0.5 rounded-tl font-medium leading-tight">
      booking.com
    </span>
  )}
</div>
```

---

#### 2. `src/components/WeeklyCalendar.tsx`

**Locations to update:**

| Section | Line Range | Change |
|---------|------------|--------|
| Extension cell | ~276-280 | Add badge below center dot |
| Split cell (IN/OUT) | ~281-289 | Add badge to bottom section |
| Checkout cell | ~290-293 | Add badge below "OUT" text |
| Check-in cell | ~294-297 | Add badge below "IN" text |
| Staying cell | ~298-301 | Add badge below center dot |

**Implementation example for staying cell:**

```tsx
} : staying ? (
  <div className={`h-full flex flex-col items-center justify-center relative ${getReservationColor(staying.source, staying.status)}`}>
    <div className="w-2 h-2 rounded-full bg-white"></div>
    {staying.source?.toLowerCase().includes('booking') && (
      <span className="absolute bottom-0 right-0 text-[5px] bg-[#003580] text-white px-0.5 rounded-tl font-medium leading-tight">
        B.com
      </span>
    )}
  </div>
) : null
```

Note: In WeeklyCalendar, cells are smaller, so use abbreviated "B.com" text.

---

### Badge Variations by Component

| Component | Badge Text | Font Size | Notes |
|-----------|-----------|-----------|-------|
| AvailabilityCalendar | "booking.com" | 6px | Full text, cells are larger |
| RoomCalendar (sheet) | Already has source badge | - | No change needed |
| MobileCalendarView | Already has source badge | - | No change needed |
| WeeklyCalendar | "B.com" | 5px | Abbreviated, cells are compact |

---

### Implementation Notes

1. **Consistency**: Badge appears in the main calendar grid cells (AvailabilityCalendar, WeeklyCalendar) where users need quick visual identification

2. **Color Choice**: Using Booking.com's official brand color (#003580) for instant recognition

3. **Positioning**: Bottom-right corner chosen because:
   - Top-right is reserved for EXT/CHECK IN badges
   - Guest name is centered vertically
   - Won't obscure guest name text

4. **Non-intrusive**: Small 6px/5px font size keeps it visible but not distracting

5. **Source Detection**: Checks if `source` field contains "booking" (case-insensitive) to match existing patterns in the codebase

---

### Expected Result

After implementation:
- AvailabilityCalendar cells for Booking.com reservations will show a small dark blue "booking.com" badge in the bottom-right corner
- WeeklyCalendar cells will show "B.com" badge for Booking.com reservations
- Admin bookings and Direct Website bookings will have no badge (differentiated by cell background color already)
- Consistent appearance across desktop calendar views

