

## Phase 2 Implementation Plan: Wire All Frontend Queries to Active Property Context

### Current State
- Database migration is complete: `property_id` columns exist on `units`, `reservations`, and `rate_plans` with indexes, backfill, and auto-assign triggers
- `usePropertyFilter` hook exists with `usePropertyId()` and `withPropertyFilter()` helpers
- 12 files already updated: `Dashboard.tsx`, `Rooms.tsx`, `ReservationsList.tsx`, `RoomCalendar.tsx`, `WeeklyCalendar.tsx`, `Housekeeping.tsx`, `CheckInOut.tsx`, `CreateReservationDialog.tsx`, `RoomTypes.tsx`, `pms/Prices.tsx`, `pms/Restrictions.tsx`, `front-desk/RoomRates.tsx`, `channex/PropertySync.tsx`, `channex/PropertySettings.tsx`
- Build is currently clean (no errors)

### Remaining Files to Update

Each file gets the same treatment:
1. Add `import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';`
2. Add `const propertyId = usePropertyId();` inside the component
3. Wrap relevant `supabase.from('units')`, `supabase.from('reservations')`, and `supabase.from('rate_plans')` queries with `withPropertyFilter(..., propertyId)`
4. Replace any `.eq('location', 'ICONIA')` with the property filter
5. Add `propertyId` to dependency arrays where needed

#### Batch 1: Analytics (1 file, ~10 query sites)
**`src/pages/Analytics.tsx`** -- The largest single file. Has 4 `.eq('location', 'ICONIA')` on unit queries (lines 302, 424, 631, 670) plus ~8 reservation queries that need wrapping. All inside `fetchAllStats`, `fetchOccupancyDetails`, `fetchBookingsDetails`, `fetchGuestsDetails`, `fetchSourcesDetails`, `fetchTotalRevenueDetails`, `fetchNetRevenueDetails`, `fetchCommissionDetails`, `fetchDirectSourceDetails`. Add `propertyId` to the useEffect dependency for `fetchAllStats`.

#### Batch 2: AvailabilityCalendar (1 file, ~3 query sites)
**`src/components/AvailabilityCalendar.tsx`** -- Has `.eq('location', 'ICONIA')` at line 380, plus `.eq('location', selectedLocation)` at line 435. The location switcher between ICONIA/Almaza Bay needs to be replaced with property context. The `fetchUnitCounts` function fetches both ICONIA and Almaza Bay counts -- this will be simplified to use the active property only.

#### Batch 3: Operations Pages (3 files)
- **`src/pages/CashSettlement.tsx`** -- 1 reservation query (line 72-83). Wrap with property filter, add `propertyId` to queryKey.
- **`src/pages/Commissions.tsx`** -- 1 reservation query (line 76-83). Wrap with property filter.
- **`src/pages/GuestTickets.tsx`** -- 1 ticket query with reservation join (line 56-76). Wrap with property filter on the reservation join or add direct filter.

#### Batch 4: Guest Management (3 files)
- **`src/pages/GuestAccounts.tsx`** -- 1 reservation query (line 109-114). Wrap with property filter.
- **`src/pages/GuestForms.tsx`** -- 1 reservation query (line 135-150). Wrap with property filter.
- **`src/pages/Guests.tsx`** -- 1 reservation query (line 149-155). Wrap with property filter.

#### Batch 5: Booking & Reservation Pages (3 files)
- **`src/pages/BookingComReservations.tsx`** -- 3 unit queries with `.eq('location', 'ICONIA')` (lines 164, 180, 433). Replace all with property filter.
- **`src/pages/ReservationDetail.tsx`** -- Unit queries for room reassignment. Wrap with property filter.
- **`src/components/PendingAssignmentsAlert.tsx`** -- 1 reservation query (line 49-53). Wrap with property filter.

#### Batch 6: Dialogs (2 files)
- **`src/components/RoomTransferDialog.tsx`** -- 1 unit query (line 115-119). Wrap with property filter.
- **`src/components/RoomSwapDialog.tsx`** -- No unit query (queries reservations by overlap). No change needed.

#### Batch 7: Channex (2 files)
- **`src/pages/ChannexDebug.tsx`** -- 2 queries (units line 83, rate_plans line 85). Wrap with property filter.
- **`src/components/channex/SyncLogs.tsx`** -- 1 unit query (line 48). Wrap with property filter.

#### Batch 8: Analytics Sub-components (1 file)
- **`src/components/analytics/CancellationAnalytics.tsx`** -- Receives `startDate`/`endDate` as props, queries reservations internally. Wrap with property filter.

#### Batch 9: BlockedDatesManager (1 file)
- **`src/components/BlockedDatesManager.tsx`** -- 2 queries (units line 85-89, blocked_dates line 101-111). Wrap units query with property filter.

### Insert Operations
Files that create units or reservations need `property_id` added to the insert payload:
- `CreateReservationDialog.tsx` (already has hook, needs insert update)
- `BookingComReservations.tsx` (creates reservations from screenshots)
- `Rooms.tsx` (creates units)
- The database trigger will auto-assign the default property as a safety net, but explicit is better.

### Implementation Order
All files will be updated in a single pass since the pattern is mechanical and consistent. The total is approximately 17 files with ~35 query modification sites.

### Risk Notes
- `AvailabilityCalendar.tsx` has a location switcher (ICONIA / Almaza Bay) that currently uses `.eq('location', selectedLocation)`. This will be replaced with the property switcher context so the calendar always shows the active property.
- `ReservationDetail.tsx` is a single-reservation view -- filtering the reservation fetch by property_id is optional since the reservation ID itself is unique. However, the unit dropdown for reassignment should be property-filtered.
- Guest portal pages (`guest/Dashboard.tsx`, `guest/Login.tsx`, etc.) do NOT get property filtering since they're public-facing.

