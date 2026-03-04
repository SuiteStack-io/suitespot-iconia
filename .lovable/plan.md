

## Simplify Channex Rate Sync to Manual-Only

### Current Problems
1. **QuickRateGrid** (`syncNow`): Inserts into `channex_sync_queue` per-change, then fire-and-forgets `channex-process-sync-queue` (which has a 30s sleep)
2. **Prices page** (`syncRatesToChannex`): Inserts into `channex_sync_queue`, then `await`s `channex-process-sync-queue` (30s block)
3. **DB trigger** `notify_channex_rate_change`: On `rate_plan_prices` INSERT/UPDATE, auto-inserts into `channex_sync_queue` AND calls the edge function via `pg_net` — causes duplicate syncs and race conditions
4. The `channex-process-sync-queue` edge function has a 30-second sleep for batching

### New Approach
Create a single **direct** edge function `channex-sync-rates` that takes rate values and pushes them to Channex in one call. No queue, no timers, no batching delay.

### Changes

#### 1. New edge function: `supabase/functions/channex-sync-rates/index.ts`
- Accepts `{ values, propertyId }` where `values` are Channex-ready rate objects
- Resolves Channex property ID and rate plan IDs from `channex_mappings`
- Makes ONE `POST /api/v1/restrictions` call to Channex
- Logs to `channex_sync_logs`
- Returns success/failure

#### 2. Update `QuickRateGrid.tsx` — `syncNow()`
- Remove all `channex_sync_queue` inserts (lines 489-508)
- Remove `channex-process-sync-queue` invocation (line 514)
- After persisting to `rate_plan_date_overrides`, call `channex-sync-rates` with the batched changes
- Keep existing progress bar and local state updates

#### 3. Update `Prices.tsx` — `syncRatesToChannex()`
- Remove `channex_sync_queue` insert (line 126)
- Remove `channex-process-sync-queue` invocation (line 130)
- Call `channex-sync-rates` directly with base rate values

#### 4. DB trigger: Remove or neuter `notify_channex_rate_change`
- Migration to DROP the trigger on `rate_plan_prices` that auto-fires sync queue inserts + `pg_net` calls
- Keep the function for reference but remove the trigger so base rate saves don't auto-sync
- **Note**: Availability and blocked-date triggers remain unchanged (those are separate concerns)

#### 5. Unsaved changes warning
- Add `beforeunload` handler in `QuickRateGrid` to warn when `pendingChanges.size > 0`

### Files
- **New**: `supabase/functions/channex-sync-rates/index.ts`
- **Edit**: `src/components/pms/QuickRateGrid.tsx` — replace queue logic with direct edge function call
- **Edit**: `src/pages/pms/Prices.tsx` — replace queue logic with direct edge function call
- **Database migration**: Drop `trigger_channex_rate_change` on `rate_plan_prices`

### What stays unchanged
- `channex-process-sync-queue` remains for availability/restriction syncs triggered by reservations and blocked dates
- `channex_sync_queue` table remains for those non-rate use cases
- Availability triggers (`notify_channex_availability_change`, `notify_channex_blocked_dates_change`) remain

