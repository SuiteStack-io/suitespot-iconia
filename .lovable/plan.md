

## Property Switcher UI Implementation

### What Already Exists
- `PropertySwitcher` component in `SlideMenu` (basic Select dropdown)
- `PropertyProvider` context with `activeProperty`, `setActiveProperty`, localStorage persistence
- `withPropertyFilter` / `usePropertyId` hooks used across ~30 files
- All major pages already filter by `propertyId`

### What Needs to Change

#### 1. Redesign PropertySwitcher Component
Upgrade `src/components/PropertySwitcher.tsx` from a plain Select to a styled dropdown that:
- Shows property name + city (e.g. "ICONIA Zamalek -- Cairo")
- Uses a checkmark on the active property
- Matches the dark sidebar theme (warm gray background)
- Shows a `Building2` icon and chevron

#### 2. Add Property Indicator to Header Bar
In `src/pages/Index.tsx` header, add a subtle property badge next to the user avatar showing the active property name with a colored dot. Use `usePropertySafe` to read it.

#### 3. Remove Location Tabs from RoomCalendar
In `src/components/RoomCalendar.tsx`:
- Remove the `selectedLocation` state and the ICONIA/Almaza Bay Tabs
- Remove `fetchUnitCounts` for separate locations
- The calendar already uses `withPropertyFilter` via `propertyId` -- just remove the `.eq('location', selectedLocation)` filter since the property switcher now handles scoping
- Show a simple unit count badge instead of the tabs

#### 4. Remove Location Tabs from RevenueByRoom
In `src/components/RevenueByRoom.tsx`:
- Same pattern -- remove the ICONIA/Almaza Bay location tabs
- Rely on global property context filtering

#### 5. Verify All Listed Pages Already Filter by Property
These pages already use `withPropertyFilter`: Dashboard, ReservationsList, CheckInOut, Housekeeping, Front Desk Room Rates, Prices, Availability, Restrictions, Commissions, Analytics, ShuffleHistory, BookingComReservations. Only the calendar and revenue-by-room need the location tabs removed.

### Files to Modify
1. `src/components/PropertySwitcher.tsx` -- redesign with city, checkmark, dark theme
2. `src/pages/Index.tsx` -- add property badge in header
3. `src/components/RoomCalendar.tsx` -- remove location tabs, remove `.eq('location', selectedLocation)`
4. `src/components/RevenueByRoom.tsx` -- remove location tabs
5. `src/components/MobileCalendarView.tsx` -- check if it also has location tabs to remove

