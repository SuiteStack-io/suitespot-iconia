

## Fix: Remove Ghost Property and Prevent Future Ghost Syncs

### Root Cause
The `channex_mappings` table still has a property mapping row for the deleted property `4484e7cf-...`. The daily sync (`channex-daily-sync`) iterates ALL property mappings without checking if the property still exists in the `properties` table. The UI in `PropertySync.tsx` only shows properties from the `properties` table, so the ghost doesn't appear there — but backend syncs still process it.

### Changes

#### 1. Database Cleanup (insert tool — 3 DELETE statements)
```sql
-- Remove ghost property mapping
DELETE FROM channex_mappings WHERE local_id = '4484e7cf-d0a0-42c8-bf96-94ca642c1eee';

-- Remove ghost property config
DELETE FROM channex_property_config WHERE property_id = '4484e7cf-d0a0-42c8-bf96-94ca642c1eee';

-- Remove any pending/failed sync queue items for ghost property
DELETE FROM channex_sync_queue WHERE property_id = '4484e7cf-d0a0-42c8-bf96-94ca642c1eee';
```

#### 2. Fix `channex-daily-sync` — validate properties exist
**File**: `supabase/functions/channex-daily-sync/index.ts`

After fetching `propertyMappings` (line 61), add a validation step that filters out any mapping whose `local_id` doesn't exist in the `properties` table:

```ts
// After line 66 (after the empty check)
const { data: activeProperties } = await supabase
  .from("properties")
  .select("id");
const activePropertyIds = new Set((activeProperties || []).map((p: any) => p.id));
const validMappings = propertyMappings.filter((m: any) => activePropertyIds.has(m.local_id));

if (validMappings.length === 0) {
  return respond(200, { success: true, message: "No active synced properties", ... });
}
```

Then iterate `validMappings` instead of `propertyMappings` in the `for` loop at line 75.

#### 3. Fix `channex-full-sync` — validate property exists
**File**: `supabase/functions/channex-full-sync/index.ts`

After fetching `propMapping` (line 59), add a check that the property exists in the `properties` table:

```ts
const { data: propertyExists } = await supabase
  .from("properties")
  .select("id")
  .eq("id", propertyId)
  .maybeSingle();

if (!propertyExists) {
  return respond(400, { success: false, error: "Property not found in properties table" });
}
```

### Summary
- 3 data deletions to clean ghost property references
- 2 edge function edits to add property existence validation
- No UI changes needed (UI already reads from `properties` table)

