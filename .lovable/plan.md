

## Plan: Wire Property Filtering Into All Remaining Files

### Summary
15 files have the `usePropertyFilter` imports but are not actually using them in their queries. Each file needs `const propertyId = usePropertyId()` declared in the component body and `withPropertyFilter(...)` wrapping the relevant `supabase.from('units')` / `supabase.from('reservations')` queries. One file (ReservationDetail.tsx) is missing the import entirely.

### Files and Changes

#### 1. `src/pages/CashSettlement.tsx`
- Add `const propertyId = usePropertyId();` in the component
- Wrap the reservations query (line 73) with `withPropertyFilter(..., propertyId)`
- Add `propertyId` to `queryKey`

#### 2. `src/pages/Commissions.tsx`
- Add `const propertyId = usePropertyId();` in the component
- Wrap the reservations query (line 77) with `withPropertyFilter(..., propertyId)`
- Add `propertyId` to the `useEffect` dependency array

#### 3. `src/pages/GuestTickets.tsx`
- Add `const propertyId = usePropertyId();` in the component
- The `guest_tickets` table doesn't have `property_id`, but tickets join to `reservations` which does. Since tickets are fetched via join, we can't directly filter. Instead, we'll do client-side filtering using the reservation's property context, or leave as-is since tickets are cross-property by nature.
- **Decision**: Skip direct filtering on `guest_tickets` since it doesn't have a `property_id` column. The ticket is linked to a reservation, but PostgREST doesn't support filtering on joined table columns in `.eq()`. We'll leave this file as-is (imports already present for future use).

#### 4. `src/pages/GuestAccounts.tsx`
- Add `const propertyId = usePropertyId();` in the component
- Wrap the reservations query (line 110) with `withPropertyFilter(..., propertyId)`

#### 5. `src/pages/GuestForms.tsx`
- Add `const propertyId = usePropertyId();` in the component
- Wrap the reservations query (line 136) with `withPropertyFilter(..., propertyId)`
- Add `propertyId` to the `useEffect` dependency

#### 6. `src/pages/Guests.tsx`
- Add `const propertyId = usePropertyId();` in the component
- Wrap the reservations query (line 150) with `withPropertyFilter(..., propertyId)`
- Add `propertyId` to the `useEffect` dependency

#### 7. `src/pages/BookingComReservations.tsx`
- Add `const propertyId = usePropertyId();` in the component
- Replace `.eq('location', 'ICONIA')` with `withPropertyFilter(...)` at 3 query sites (lines 162-166, 178-182, 431-435)
- Add `propertyId` to the `useEffect` dependency for `fetchUnits`

#### 8. `src/pages/ReservationDetail.tsx`
- Add `import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';`
- Add `const propertyId = usePropertyId();` in the component
- Wrap the units query (line 291) with `withPropertyFilter(..., propertyId)`

#### 9. `src/components/PendingAssignmentsAlert.tsx`
- Add `const propertyId = usePropertyId();` in the component
- Wrap the reservations query (line 50) with `withPropertyFilter(..., propertyId)`

#### 10. `src/components/RoomTransferDialog.tsx`
- Add `const propertyId = usePropertyId();` in the component
- Wrap the units query (line 116) with `withPropertyFilter(..., propertyId)`

#### 11. `src/pages/ChannexDebug.tsx`
- Add `const propertyId = usePropertyId();` in the component
- Wrap `units` and `rate_plans` queries (lines 84, 86) with `withPropertyFilter(..., propertyId)`

#### 12. `src/components/channex/SyncLogs.tsx`
- Add `const propertyId = usePropertyId();` in the component (note: it's not a hook-level component -- need to check if it's a function component, which it is)
- Wrap the units query (line 49) with `withPropertyFilter(..., propertyId)`

#### 13. `src/components/analytics/CancellationAnalytics.tsx`
- Add `const propertyId = usePropertyId();` in the component
- Wrap both reservation queries (lines 87, 94) with `withPropertyFilter(..., propertyId)`
- Add `propertyId` to the `useEffect` dependency

#### 14. `src/components/BlockedDatesManager.tsx`
- Add `const propertyId = usePropertyId();` in the component
- Wrap the units query (line 86) with `withPropertyFilter(..., propertyId)`

#### 15. `src/components/AvailabilityCalendar.tsx`
- Replace the `selectedLocation` state and location tabs with property context
- Remove `fetchUnitCounts` (lines 377-392) -- no longer needed since property switcher handles this
- Replace `.eq('location', selectedLocation)` in `fetchData` (line 436) with `withPropertyFilter(..., propertyId)`
- Remove the ICONIA/Almaza Bay tabs from the UI
- Add `propertyId` to the `useEffect` dependency instead of `selectedLocation`
- Remove `iconiaCount`, `almazaBayCount`, `selectedLocation` state variables

### Technical Details
- The `withPropertyFilter` helper applies `.eq('property_id', propertyId)` to any Supabase query builder when `propertyId` is non-null
- For `AvailabilityCalendar`, the location switcher tabs will be removed since the global `PropertySwitcher` in the navigation now controls which property's data is shown
- `GuestTickets` will be left without direct filtering since the `guest_tickets` table lacks a `property_id` column -- this could be addressed in a future migration

### Risk Notes
- AvailabilityCalendar has a location tabs UI that will be removed. The property switcher in the nav replaces this functionality.
- ReservationDetail fetches a single reservation by ID (no property filter needed on that query), but the unit dropdown for reassignment should be property-filtered.

