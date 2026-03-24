

## Fix: Rooms page showing all properties' rooms

### Root Cause
`fetchUnits()` already uses `withPropertyFilter(query, propertyId)`, but:
1. The `useEffect` (line 205) depends only on `[user]`, not `propertyId` — so it never re-fetches when the active property changes.
2. If `propertyId` is `null` at mount time (race condition), `withPropertyFilter` is a no-op and returns ALL units.

### Changes — Single file: `src/pages/Rooms.tsx`

**1. Add `propertyId` guard to `fetchUnits`** (line ~248)
- If `!propertyId`, set `units` to `[]` and return early. No query runs without a valid property.

**2. Add `propertyId` to the `useEffect` dependency array** (line ~246)
- Change `[user]` → `[user, propertyId]` so the room list refreshes whenever the active property changes in the switcher.

**3. Add `propertyId` guard to `fetchReservations`** (if it exists and queries without property filter — will verify)
- Same pattern: skip query if no `propertyId`.

These two small changes ensure:
- Rooms only load for the active property
- Switching properties triggers an immediate refresh
- The header counts ("7 room types · 35 units") automatically reflect only the active property since they derive from the `units` state
- Add Room already passes `property_id: propertyId` (line 584) — no change needed
- Bulk edit operates on `units` state which will already be property-scoped — no change needed

