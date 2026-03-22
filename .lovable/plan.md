
Root cause confirmed in `src/pages/BookingComReservations.tsx`:

1) The multi-room dropdown is populated from `unitsWithStatus` (rendered at ~1905/2029), which comes from `fetchUnitsWithStatus` (~185).  
2) `fetchUnitsWithStatus` uses `withPropertyFilter(...)`, but has no `propertyId` guard. If `propertyId` is null at call time, it queries all units.  
3) It is called once after parse (~349), so if it runs before property context resolves, cross-property results persist in the modal.  
4) There is also an unfiltered fallback units query in conflict flow (~820), plus auto-suggest path in `parse-reservation-screenshot` currently queries `units` without property filter.

Implementation plan:

1. **Instrument and harden Booking.com modal room-fetch path (`BookingComReservations.tsx`)**
   - In `fetchUnitsWithStatus`:
     - Add pre-query log: `console.log("Fetching rooms for property:", propertyId)`.
     - Add query-shape log (table/columns/filter metadata).
     - Add post-query log: `console.log("Rooms returned:", allUnits)`.
     - Add strict guard: if `!propertyId`, do **not** query; set `unitsWithStatus` to `[]`.
   - Add `useEffect` to re-fetch units when `propertyId` becomes available while preview modal is open and dates exist (fixes race condition).
   - In modal UI (both single-room and multi-room dropdown blocks), if `!propertyId`, show empty state text **“Loading rooms…”** and keep dropdown disabled/empty.

2. **Cover all query paths on this page**
   - `fetchAvailabilityForSegment` (~440): same `propertyId` guard + before/after logs + no-query when missing property.
   - Conflict alternative flow (`createReservationWithUnit`, ~820): replace unfiltered `from('units')...eq('status','available')` with property-scoped query; add debug logs for property and returned alternatives.

3. **Fix auto-suggest path so pre-assigned rooms cannot leak across properties**
   - In `BookingComReservations.tsx`, pass `propertyId` when invoking `parse-reservation-screenshot`.
   - In `supabase/functions/parse-reservation-screenshot/index.ts`:
     - Read `propertyId` from request body.
     - Log property_id and matched units query context.
     - Filter units query with `.eq('property_id', propertyId)`.
     - If missing propertyId, skip unit matching (no fallback to all units).
     - Log returned units used for matching.
   - Pass `propertyId` to `auto-shuffle-rooms` request.
   - In `supabase/functions/auto-shuffle-rooms/index.ts`:
     - Accept `propertyId` in payload.
     - Filter units by both room type and property_id.
     - Log property_id + units found.
     - If missing propertyId, return controlled failure (no global lookup).

4. **Protect selected values from stale cross-property assignments**
   - After fetching filtered room list, validate current `roomAssignments[].unitId` against returned unit IDs.
   - Clear any invalid assignment (set to `null`) so stale foreign-property values cannot remain selected.

5. **Verification checklist**
   - Reproduce on Booking.com screenshot modal with active property `ICONIA Zamalek`.
   - Confirm browser console shows:
     - valid property UUID,
     - property-filtered query metadata,
     - returned units list from only that property.
   - Confirm “Double Room (#102)” does not appear when it belongs to another property.
   - Confirm if propertyId is not yet ready, dropdown shows **“Loading rooms…”** with no cross-property results.
   - Confirm edge logs for `parse-reservation-screenshot`/`auto-shuffle-rooms` show the same property_id and filtered unit set.
