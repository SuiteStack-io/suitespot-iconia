

## Fix Room Dropdowns: Filter by Active Property

### Problem
Several room dropdowns show rooms from ALL properties instead of only the active property. The root causes differ by file:

### Files to Fix

**1. `src/components/ReservationQuickActions.tsx`** — 2 queries hardcode `.eq("location", "ICONIA")` instead of filtering by property_id
- **Line ~236** (`fetchExtensionUnits`): Replace `.eq("location", "ICONIA")` with `withPropertyFilter(..., propertyId)`
- **Line ~286** (`fetchAvailableUnits`): Replace `.eq("status", "available").eq("location", "ICONIA")` with `withPropertyFilter(..., propertyId).eq("status", "available")`
- Add `import { usePropertyId, withPropertyFilter } from "@/hooks/usePropertyFilter"` and call `usePropertyId()` in the component (this component receives props but needs hook access — will need to add it at the component level or receive propertyId as a prop)

**2. `src/components/CreateReservationDialog.tsx`** — 1 unfiltered query
- **Line ~361** (`allUnitsData` query for occupancy chart): `supabase.from("units").select("id").eq("status", "available")` has NO property filter. Wrap with `withPropertyFilter(..., propertyId)`

**3. `src/pages/BookingComReservations.tsx`** — Already correctly uses `withPropertyFilter` on all 3 unit queries (`fetchUnits`, `fetchUnitsWithStatus`, `fetchAvailabilityForSegment`). The bug the user sees may be caused by `propertyId` being null when the query first runs (race condition with property context loading). Will add a guard: skip fetching units if `propertyId` is null, and re-fetch when it becomes available.

### Technical Details

- `ReservationQuickActions` is the biggest offender — completely ignoring property context and hardcoding "ICONIA"
- For `ReservationQuickActions`, since it's a component (not a page), it already has access to hooks. Will add `const propertyId = usePropertyId()` and replace the hardcoded location filters
- For `CreateReservationDialog`, the occupancy chart query is a minor leak but should be fixed for correctness
- For `BookingComReservations`, will add `if (!propertyId) return` guard to `fetchUnits` and `fetchUnitsWithStatus` to prevent querying with null filter

### No Changes To
- Room data, existing assignments, property switcher logic, screenshot parsing logic
- RoomTransferDialog (already uses `withPropertyFilter`)
- RoomCalendar (already uses `withPropertyFilter`)

