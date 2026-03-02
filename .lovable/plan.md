

## Fix: "Run Full Sync Now" Timing Out

### Root Cause
The `channex-daily-sync` edge function processes all properties sequentially with 6-second delays between batches (to respect Channex rate limits). With 2 properties, ~7 room types, and ~4 rate plans, it makes dozens of API calls taking 2-3+ minutes total. The Supabase client HTTP connection times out (~60s), so the frontend shows "Failed" even though the function completes successfully in the background.

### Fix
**File: `src/components/channex/ConnectionStatus.tsx`**

Change the "Run Full Sync Now" handler to:
1. Fetch all properties with `channex_synced = true`
2. Call `channex-full-sync` for each property **sequentially** (one at a time), which is faster per-call since it's scoped to a single property
3. Show progress: "Syncing property 1 of 2..."
4. Show per-property results with task IDs when done

This reuses the already-working `channex-full-sync` function and avoids the timeout issue since each per-property call is shorter.

### Changes
- `src/components/channex/ConnectionStatus.tsx` — update `runFullSync` to loop through properties calling `channex-full-sync` individually, with progress feedback via toast updates

