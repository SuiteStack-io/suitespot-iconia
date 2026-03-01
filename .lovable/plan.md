

## Multi-Property Channex Integration

### Current Architecture
The Channex integration is built around a **single-row** `channex_property_config` table. Both the frontend (`PropertySync.tsx`) and the edge function (`channex-sync-property`) query this table with `.limit(1).maybeSingle()`. The `properties` table already has `channex_property_id`, `channex_synced`, and `channex_last_sync` columns, but they are unused by the Channex sync system.

### Plan

**1. Refactor `PropertySync.tsx` to show all properties**
- Query the `properties` table (all rows) instead of `channex_property_config` (single row)
- For each property, look up its Channex mapping from `channex_mappings` (where `entity_type = 'property'` and `local_id = property.id`)
- Query units per property using `property_id` filter
- Show each property as a collapsible card with sync status, room types count, and Channex ID
- Expandable sections for synced room types, rate plans, and derived rate plans (filtered by that property's units/rate plans)

**2. Update `channex-sync-property` edge function to accept a `propertyId`**
- Accept `{ propertyId }` from request body
- Load property details from the `properties` table (not `channex_property_config`)
- Filter units by `property_id` instead of hardcoded `.eq('location', 'ICONIA')`
- Filter rate plans by `property_id`
- Store channex mapping with `local_id = property.id`
- Update `properties.channex_property_id` and `properties.channex_synced` on success
- Fall back to `channex_property_config` if no `propertyId` is provided (backward compatibility)

**3. Update `PropertySync` sync action**
- Pass the property ID when invoking the edge function: `supabase.functions.invoke('channex-sync-property', { body: { propertyId: property.id } })`
- Each property gets independent sync/refresh buttons

**4. Update `PropertySettings.tsx`**
- Add a property selector dropdown so settings can be viewed/edited per property
- Or keep current single-config behavior but note it applies to the default property only

### Files to change
- `src/components/channex/PropertySync.tsx` — full rewrite to multi-property cards
- `supabase/functions/channex-sync-property/index.ts` — accept `propertyId`, query `properties` table, filter units/rate plans by property

### No database migration needed
The `properties` table already has `channex_property_id`, `channex_synced`, and `channex_last_sync` columns ready to use.

