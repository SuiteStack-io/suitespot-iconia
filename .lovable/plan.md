

## Add Room/Plan Name Columns to Channex Sync Tables

The three tables (Synced Room Types, Synced Rate Plans, Derived Rate Plans) currently only show UUIDs. I'll add human-readable name columns by cross-referencing fetched data.

### Changes to `src/components/channex/PropertySync.tsx`

1. **Fetch rate plans** alongside units in `fetchData` -- add a query for `rate_plans` selecting `id, name, room_type`
2. **Store units as a lookup map** (id → name) from the already-fetched units data
3. **Synced Room Types table**: Add "Room Name" column, resolved by looking up `local_id` in the units map (using `booking_com_name || name`)
4. **Synced Rate Plans table**: Add "Plan Name" and "Room Type" columns, resolved by looking up `local_id` in the rate plans data
5. **Derived Rate Plans table**: Add "Base Plan Name" column, resolved by looking up `local_id` in the rate plans data (the `local_id` for derived mappings references the base rate plan)

### Data Flow
- Units are already fetched (`id, name, booking_com_name`) -- just need to keep the raw array for lookup
- Rate plans need a new fetch: `supabase.from('rate_plans').select('id, name, room_type')`
- Lookups are done client-side via `.find()` on the arrays

