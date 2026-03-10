

## Fix: Backfill fails due to invalid `property_id` in `channex_bookings`

### Root Cause
The failing booking (`f0d1b35f...`, guest "ramy khorshed") has `property_id = e30ad118-...` in the `channex_bookings` table, but that UUID doesn't exist in the `properties` table. This causes a foreign key violation when inserting into `reservations`.

The `room_type_id` on that booking (`ab59a9b4...`) points to a unit in property `c98a2256...` (ICONIA Zamalek), which is the correct property.

### Fix in `sync-channex-to-reservations/index.ts`

Before inserting into `reservations`, resolve the correct `property_id` by:
1. If `room_type_id` exists, look up the unit and use its `property_id`
2. Fall back to the `property_id` from `channex_bookings` only if it exists in the `properties` table
3. If neither works, set `property_id` to `null` (the reservations table allows it)

### Changes

**File: `supabase/functions/sync-channex-to-reservations/index.ts`**
- After the unit allocation block (~line 124), add validation:
  - If `allocatedUnitId` was found, use its property from the unit lookup
  - If `room_type_id` resolved a unit, use that unit's `property_id`
  - Otherwise, validate `localPropertyId` exists in `properties` table before using it
- Replace `property_id: localPropertyId` in the insert with the resolved value

This is a ~10-line addition to the existing function. No other files need changes.

