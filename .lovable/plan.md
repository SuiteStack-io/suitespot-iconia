

## Fix: Channex Property ID Reading from Wrong Source

### Root Cause
`PropertySync.tsx` reads the Channex Property ID from `properties.channex_property_id` (line 278) instead of from `channex_mappings`. The `channex_mappings` table has the correct production ID but the `properties` table column was never updated.

### Changes

**File: `src/components/channex/PropertySync.tsx`**

1. **Display the Channex ID from `channex_mappings`** — Change line 278 to use `propertyMapping?.channex_id` instead of `property.channex_property_id`

2. **Fix the "Synced" badge logic** — Change line 234 from `!!property.channex_property_id` to `!!propertyMapping` so sync status is also derived from `channex_mappings`

3. **Fix the "Full Sync (500 days)" visibility** — Same variable `isSynced` controls this, so it will automatically use the correct source after step 2

**Database migration** — Update the stale `properties.channex_property_id` to match `channex_mappings`:
```sql
UPDATE properties p
SET channex_property_id = cm.channex_id
FROM channex_mappings cm
WHERE cm.local_id = p.id
  AND cm.entity_type = 'property'
  AND cm.sync_status = 'synced';
```

### Summary of line changes
- Line 234: `const isSynced = !!propertyMapping;`
- Line 278: display `propertyMapping?.channex_id` instead of `property.channex_property_id`

Two lines changed in one file, plus one data migration to sync the `properties` table.

