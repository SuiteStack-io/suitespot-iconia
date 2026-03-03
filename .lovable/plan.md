

## Fix Stale Rates Display & Add Channex Sync Button to Rate Plans Tab

### Issue: Wrong rates displayed ($444/$490)
The database values are **correct** ($120 weekday / $135 weekend for all 4 plans). The screenshot shows stale cached data. This will resolve on page refresh. No code bug here.

### Feature: "Save Changes" button on Rate Plans tab

The Rate Plans tab currently has no Channex sync. When base rates are edited, they're saved to the database but never pushed to Channex. The user wants a single button that pushes all rate plans' base rates to Channex in one batch call.

### Changes in `src/pages/pms/Prices.tsx`

**1. Add "Save Changes" button**
- Black button at the top of the Rate Plans tab content area (next to the heading)
- On click, gather all rate plans with their base prices (where `unit_id` is null)
- Call the existing `channex-push-rates` edge function with a batch `updates` array containing all rate plans
- Each update uses the rate plan's `valid_from`/`valid_to` dates (or a default 500-day range if not set)
- Show loading state while syncing, then success/error toast

**2. Batch payload structure**
- The `channex-push-rates` function already supports a `updates` array
- Each entry: `{ property_id, rate_plan_id, date_from, date_to, rate (weekday), min_stay_arrival }`
- Weekend rates need separate entries or the edge function needs adjustment — checking the Channex API, rates are pushed per-day so the sync queue approach is actually better

**3. Alternative: Use the sync queue**
- Instead of calling `channex-push-rates` directly, insert entries into `channex_sync_queue` for each rate plan (type: `rate`, with the rate plan's date range)
- The existing `channex-process-sync-queue` function handles weekday/weekend rate differentiation and 30-day chunking
- This is more reliable and consistent with the existing architecture

### Implementation
- Add a `syncRatesToChannex` function that:
  1. For each active rate plan with a base price, inserts a `channex_sync_queue` entry with `sync_type = 'rate'`, the plan's property_id, rate_plan_id, and date range
  2. Shows progress via toast
- Add a black "Save Changes" `<Button>` with `className="bg-black text-white hover:bg-black/90"` in the Rate Plans tab header area
- Add `syncing` state to disable the button during operation

### Single file change: `src/pages/pms/Prices.tsx`

