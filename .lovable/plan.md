

## Channex Certification Completion - Remaining Gaps

Most of the 8 features you requested are already fully implemented. Here's what actually needs to be done to close the remaining gaps.

### What's Already Working (No Changes Needed)

| Feature | Status |
|---------|--------|
| Automatic Rate Push (triggers + queue) | Done |
| Automatic Availability Push (triggers + queue) | Done |
| Restrictions UI (calendar, bulk editor, defaults) | Done |
| Booking Modifications & Cancellations (webhook) | Done |
| Queue System (channex_sync_queue + processor) | Done |
| Database tables (queue, restriction columns) | Done |

### Changes Required

#### 1. Extend Daily Sync to 500 Days

**File: `supabase/functions/channex-daily-sync/index.ts`**
- Change `addDays(today, 365)` to `addDays(today, 500)` on line 72
- One-line change

#### 2. Add "Run Full Sync" Button + Status to Admin UI

**File: `src/components/channex/ConnectionStatus.tsx`**
- Add a "Run Full Sync" button that invokes `channex-daily-sync` manually
- Display last full sync timestamp by querying `channex_sync_logs` where `function_name = 'channex-daily-sync'`
- Add queue status summary showing pending/processing/failed counts from `channex_sync_queue`

#### 3. Handle `restriction` Sync Type in Queue Processor

**File: `supabase/functions/channex-process-sync-queue/index.ts`**
- Add a third category alongside `availabilityItems` and `rateItems`: `restrictionItems` for `sync_type = 'restriction'`
- Process restriction items by resolving Channex IDs and pushing via `POST /api/v1/restrictions`
- This ensures the existing DB trigger on `rate_plan_restrictions` (which queues restriction changes) gets processed

### Technical Details

```text
Files to modify:
  1. supabase/functions/channex-daily-sync/index.ts      (365 -> 500)
  2. src/components/channex/ConnectionStatus.tsx           (add Full Sync button + status)
  3. supabase/functions/channex-process-sync-queue/index.ts (add restriction processing)

No new database migrations needed.
No new edge functions needed.
No new config.toml entries needed.
```

#### ConnectionStatus.tsx Additions

The Connection & Health Status card will gain:
- **Full Sync section**: A "Run Full Sync (500 days)" button with confirmation dialog, showing last sync time and result
- **Queue Status section**: Live counts of pending, processing, failed, and completed queue items
- Both sections refresh on load and after actions

#### Queue Processor Restriction Handling

The `channex-process-sync-queue` function will add processing for items with `sync_type = 'restriction'`:
- Resolve rate plan's Channex ID from mappings
- Resolve property Channex ID
- Read restriction fields from the queue item's `payload` (min_stay, max_stay, stop_sell, CTA, CTD)
- Push to `POST /api/v1/restrictions` in a single batched call
- Mark items completed/failed

