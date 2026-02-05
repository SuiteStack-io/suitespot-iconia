

## Rename "Suite Name" to "Room Name" Across Dashboard

### Overview

This plan updates all UI labels from "Suite Name" to "Room Name" for consistency across the application. This is a UI labeling change only - no database schema modifications are required.

---

### Files to Modify

| File | Location | Change |
|------|----------|--------|
| `src/pages/Rooms.tsx` | Line 872, 1548, 1597 | Table header & dialog labels |
| `src/pages/ReservationDetail.tsx` | Line 1483 | Label text |
| `src/pages/Guests.tsx` | Line 569 | Table header |
| `src/components/AvailabilityCalendar.tsx` | Line 2173 | Popover label |
| `src/components/RoomCalendar.tsx` | Lines 774, 830, 961 | Header & popover labels |
| `src/components/MobileCalendarView.tsx` | Line 474 | Popover label |
| `src/components/WeeklyCalendar.tsx` | Line 219 | Column header |
| `src/components/ReservationsList.tsx` | Lines 662, 1523 | Export key & table header |
| `src/components/CreateReservationDialog.tsx` | Line 1352 | Form label |
| `src/components/RevenueByGuests.tsx` | Line 186 | Table header |
| `src/components/RevenueByRoom.tsx` | Lines 87, 93, 300, 316 | Comments, function name & table header |

---

### Detailed Changes

#### 1. Room Management (`src/pages/Rooms.tsx`)

| Line | Before | After |
|------|--------|-------|
| 872 | `>Suite Name</th>` | `>Room Name</th>` |
| 1548 | `<strong>Suite Name:</strong>` | `<strong>Room Name:</strong>` |
| 1597 | `<strong>Suite Name:</strong>` | `<strong>Room Name:</strong>` |

#### 2. Reservation Detail (`src/pages/ReservationDetail.tsx`)

| Line | Before | After |
|------|--------|-------|
| 1483 | `<Label>Suite Name</Label>` | `<Label>Room Name</Label>` |

#### 3. Guests Page (`src/pages/Guests.tsx`)

| Line | Before | After |
|------|--------|-------|
| 569 | `<TableHead>Suite Name</TableHead>` | `<TableHead>Room Name</TableHead>` |

#### 4. Availability Calendar (`src/components/AvailabilityCalendar.tsx`)

| Line | Before | After |
|------|--------|-------|
| 2173 | `Suite Name: ` | `Room Name: ` |

#### 5. Room Calendar (`src/components/RoomCalendar.tsx`)

| Line | Before | After |
|------|--------|-------|
| 774 | `Suite Name` | `Room Name` |
| 830 | `Suite Name: ` | `Room Name: ` |
| 961 | `Suite Name: ` | `Room Name: ` |

#### 6. Mobile Calendar View (`src/components/MobileCalendarView.tsx`)

| Line | Before | After |
|------|--------|-------|
| 474 | `Suite Name: ` | `Room Name: ` |

#### 7. Weekly Calendar (`src/components/WeeklyCalendar.tsx`)

| Line | Before | After |
|------|--------|-------|
| 219 | `Suite Name` | `Room Name` |

#### 8. Reservations List (`src/components/ReservationsList.tsx`)

| Line | Before | After |
|------|--------|-------|
| 662 | `'Suite Name':` | `'Room Name':` |
| 1523 | `<TableHead>Suite Name</TableHead>` | `<TableHead>Room Name</TableHead>` |

#### 9. Create Reservation Dialog (`src/components/CreateReservationDialog.tsx`)

| Line | Before | After |
|------|--------|-------|
| 1352 | `Suite Name <span>` | `Room Name <span>` |

#### 10. Revenue By Guests (`src/components/RevenueByGuests.tsx`)

| Line | Before | After |
|------|--------|-------|
| 186 | `Suite Name {getSortIcon}` | `Room Name {getSortIcon}` |

#### 11. Revenue By Room (`src/components/RevenueByRoom.tsx`)

| Line | Before | After |
|------|--------|-------|
| 87 | `// Group rooms by suite name` | `// Group rooms by room name` |
| 93 | `groupRoomsBySuiteName` | `groupRoomsByRoomName` |
| 300 | `>Suite Name</TableHead>` | `>Room Name</TableHead>` |
| 316 | `{/* Parent Row - Suite Name */}` | `{/* Parent Row - Room Name */}` |

**Variable/Interface Renames (RevenueByRoom.tsx):**
- `suiteName` → `roomName` (interface property & variables)
- `groupRoomsBySuiteName` → `groupRoomsByRoomName` (function name)
- `suiteRooms` → `groupedRooms` (variable name)

---

### Summary

| Category | Count |
|----------|-------|
| Files to modify | 11 |
| Label changes | 18 |
| Variable/function renames | 6 |
| Database changes | 0 |

---

### Notes

- The internal database field remains `name` (no schema change)
- The guest-facing display name field remains `booking_com_name`
- This change only affects UI labels for user-facing consistency
- Variable renames in `RevenueByRoom.tsx` maintain internal code consistency

