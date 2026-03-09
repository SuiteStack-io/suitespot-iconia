

## Fix channex-push-availability Mapping Resolution

### Analysis

There is **no `room_types` table** in the database. The system uses the `units` table with `booking_com_name` as the grouping key. The `channex_mappings` table stores `entity_type = 'room_type'` with `local_id` set to a specific unit ID (the first unit of each booking_com_name group, chosen during Channex property sync).

The problem: the frontend picks "the first unit per booking_com_name" at query time, but this may not match the unit ID stored in `channex_mappings` (which was chosen during the original Channex sync). If units are added/deleted, the "first" unit can change.

### Plan

**1. Fix the edge function's room type resolution** (`supabase/functions/channex-push-availability/index.ts`)

Instead of looking up `channex_mappings` by exact unit ID, resolve via the unit's `booking_com_name` — find ANY unit with that name that has a channex mapping:

```
// Instead of direct local_id lookup:
//   .eq("local_id", u.room_type_id).eq("entity_type", "room_type")
// 
// Do: get the unit's booking_com_name, then find the channex mapping
// for any unit with that same booking_com_name
```

This makes the edge function resilient to which specific unit ID the frontend sends.

**2. Update the frontend to be explicit** (`src/components/pms/BulkAvailabilityEditor.tsx`)

No changes needed to the frontend — it already sends a unit ID grouped by `booking_com_name`, and the edge function will resolve it via the name-based lookup.

### Technical Detail — Edge Function Change

In `channex-push-availability/index.ts`, replace the direct `resolveChannexId(u.room_type_id, "room_type")` call with a two-step lookup:

1. Get `booking_com_name` from `units` table using the provided `room_type_id` (unit ID)
2. Find the `channex_mappings` entry for any unit with that `booking_com_name` and `entity_type = 'room_type'`

This is ~15 lines changed in the mapping resolution section (lines 131-153).

### Files
- `supabase/functions/channex-push-availability/index.ts` — resilient room type mapping lookup

