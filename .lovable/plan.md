

## Analysis: Automatic Rate Sync to Channex

### What Already Works
The infrastructure for automatic rate syncing **already exists**:
1. A database trigger (`notify_channex_rate_change`) on `rate_plan_prices` fires on INSERT/UPDATE
2. It queues a `rate` sync item into `channex_sync_queue`
3. The `channex-process-sync-queue` edge function processes rate items and pushes to Channex API

So when you save rates in the Room Rates page, the trigger fires and the sync happens in the background.

### Issues Found

**1. Weekend rate is never pushed** -- The queue processor (line 193-206 of `channex-process-sync-queue/index.ts`) only reads `weekday_rate` from the payload and pushes that single rate for the entire date range. Weekend rates are ignored entirely.

**2. No UI feedback about Channex sync** -- The Room Rates page shows "All changes saved" but gives no indication whether the change was synced to Channex.

**3. Property resolution is not property-scoped** -- The queue processor uses `.maybeSingle()` on `channex_mappings` for `entity_type = 'property'` without filtering by the actual property, which could return the wrong property in a multi-property setup.

### Plan

#### Fix 1: Push both weekday and weekend rates (edge function)
**File: `supabase/functions/channex-process-sync-queue/index.ts`**
- Read both `weekday_rate` and `weekend_rate` from the payload
- For each 30-day chunk, push weekday rate for Sun-Thu dates and weekend rate for Fri-Sat dates (or push a single rate if both are equal)
- Resolve property mapping using the rate plan's `property_id` instead of a global lookup

#### Fix 2: Scope property resolution to correct property
**File: `supabase/functions/channex-process-sync-queue/index.ts`**
- When processing rate items, look up the rate plan's `property_id` first
- Use that to resolve the correct Channex property mapping

#### Fix 3: Add sync feedback in Room Rates UI
**File: `src/pages/RoomRates.tsx`** (the `handleSave` function)
- After saving to the database, show a secondary toast: "Syncing rates to Channex..." 
- No need to wait for the sync -- the trigger handles it asynchronously. Just inform the user the sync was queued.

### Files to Change
1. `supabase/functions/channex-process-sync-queue/index.ts` -- Fix rate processing logic
2. `src/pages/RoomRates.tsx` -- Add sync feedback toast

