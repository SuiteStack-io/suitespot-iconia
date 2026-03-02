

## Fix: Rate Sync Not Appearing in Logs + Property Name Display

### Root Causes Found

**1. Single-day rate plans produce 0 API calls (critical bug)**
The rate plan "Best Available Rate" for Nov 22 has `valid_from = 2026-11-22` and `valid_to = 2026-11-22`. The edge function uses `while (chunkStart < rangeEnd)` — since both are the same date, the loop never executes, producing 0 chunks and 0 API calls. The sync queue shows "completed" but nothing was actually pushed to Channex, and no sync log was created (only logged when `values.length > 0`).

**Fix**: Treat `date_to` as inclusive by adding 1 day to `rangeEnd` so single-day ranges work.

**2. Property ID never logged**
All `logSync()` calls in the rate/availability/restriction sections pass `null` as the `property_id` parameter, so logs never show which property they belong to.

**Fix**: Track the resolved `property_id` (local UUID) during processing and pass it to `logSync`.

**3. Sync Logs resolve property names from `units` table instead of `properties` table**
The `SyncLogs` component fetches from `units` and tries to match `property_id` against unit IDs. But `property_id` in the logs references the `properties` table. That's why it shows truncated UUIDs like "e30ad118" instead of property names.

**Fix**: Fetch from the `properties` table instead.

### Files to Change

**`supabase/functions/channex-process-sync-queue/index.ts`**
- Add +1 day to `rangeEnd` so single-day rate plans are inclusive
- Track `localPropertyId` for each rate/restriction batch and pass to `logSync`
- Do the same for availability items

**`src/components/channex/SyncLogs.tsx`**
- Replace units query with a `properties` query (`id, name`)
- Update the dropdown and `unitName` helper to use property names

