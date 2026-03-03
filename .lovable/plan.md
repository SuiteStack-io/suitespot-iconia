

## Batch Rate Sync to Single Channex API Call

### Problem
Each row update on `rate_plan_prices` triggers `notify_channex_rate_change`, which queues an item AND immediately calls `net.http_post` to invoke the processor. When you update 5 rate plans at once, 5 concurrent edge function invocations race to process items, resulting in multiple separate Channex API calls instead of one batched call.

### Solution
Two changes to make the processor naturally batch:

**1. Edge function: Add a processing delay + concurrency lock**
**File: `supabase/functions/channex-process-sync-queue/index.ts`**
- Add a 3-second sleep at the start before claiming items — this lets all triggered queue items accumulate
- Use `SELECT ... FOR UPDATE SKIP LOCKED` pattern: mark items as "processing" atomically so concurrent invocations skip already-claimed rows
- If no pending items remain after the delay (another invocation already handled them), exit early with success

**2. Database trigger: Remove redundant `net.http_post` calls for rate changes**
**Migration on `notify_channex_rate_change` function**
- Keep the queue INSERT but remove the `PERFORM net.http_post(...)` call
- Instead, add a single deferred call using `pg_notify` or keep one `net.http_post` but with a flag so only the first queued item triggers the processor
- Simplest: keep the http_post but the edge function's 3-second delay ensures all items land in the queue before processing starts

### Implementation Detail
The edge function change is minimal — add ~5 lines at the top:
```text
// Wait 3 seconds to let concurrent trigger-fired items accumulate
await new Promise(r => setTimeout(r, 3000));
```

This ensures that when you save multiple rate plans simultaneously, all queue items are inserted within milliseconds, then after the 3-second delay, the first invocation to reach the claim step grabs ALL pending items and sends them in one batched Channex API call. Subsequent invocations find zero pending items and exit immediately.

### Files to Change
1. `supabase/functions/channex-process-sync-queue/index.ts` — Add 3-second delay before claiming items

