

## Fix: Daily Sync Not Scoping by Property

### Root Cause
In `channex-daily-sync`, lines 80-84 and 217-221 query ALL `channex_mappings` for room types and rate plans without filtering by the current property. This means rate plans from Property B are processed under Property A's Channex ID, causing lookup failures and the "Failed" status.

The `channex-full-sync` function already handles this correctly by filtering units/rate plans by `property_id`.

### Fix
**File:** `supabase/functions/channex-daily-sync/index.ts`

Apply the same property-scoping pattern used in `channex-full-sync`:

1. **Room type mappings (lines 80-213):** After fetching all room type mappings, filter each one by checking if its unit belongs to the current property (`property_id = propMapping.local_id`). Skip room types from other properties.

2. **Rate plan mappings (lines 217-354):** After fetching all rate plan mappings, filter each one by checking if the rate plan's `property_id` matches the current property. Skip rate plans from other properties.

The filtering logic (for each mapping, look up the parent entity and check `property_id`) mirrors what `channex-full-sync` does at its lines 80-97 and 162-175.

### Result
Each property only syncs its own room types and rate plans. The "not found" errors disappear, and the sync logs as successful.

### Files to change
- `supabase/functions/channex-daily-sync/index.ts`

