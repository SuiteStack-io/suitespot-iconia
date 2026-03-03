

## Why Save Takes 30+ Seconds — and the Fix

### Root Cause
The `syncNow()` function in `QuickRateGrid.tsx` (line 471) calls `channex-process-sync-queue` with `await`, which means the UI blocks until the edge function returns. That edge function has a **30-second sleep** (line 38 of the function) designed to batch concurrent database-trigger-fired updates into single API calls.

The Price Lab doesn't need to wait for this. The sync queue items are already inserted; the edge function will process them regardless.

### Fix — `src/components/pms/QuickRateGrid.tsx`

Change the `await supabase.functions.invoke('channex-process-sync-queue')` call to **fire-and-forget** — don't `await` it. This way:

1. Sync queue items are inserted (already done before this call)
2. The edge function is triggered but the UI doesn't wait for it
3. DB persistence (`rate_plan_prices` update) and local state update happen immediately
4. Save completes in ~1-2 seconds instead of ~33 seconds

The change is a single line: remove `await` from the `supabase.functions.invoke` call (or move it into a `.then()` / fire-and-forget pattern).

### Files to edit
- `src/components/pms/QuickRateGrid.tsx` — remove `await` from the sync queue processing call

