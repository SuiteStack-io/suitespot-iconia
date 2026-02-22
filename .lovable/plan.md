

## Fix: Channex Rate Push 500 Internal Server Error

### Status of Both Issues

| Issue | Status |
|-------|--------|
| ERROR 2: arrival_date null | Already fixed -- columns are nullable, alert resolved |
| ERROR 1: Rate push 500 | Active -- needs fix (this plan) |

### Root Cause

The `channex-daily-sync` function pushes rate restrictions covering **365 days in a single value** (because `valid_from`/`valid_to` are null on all rate plans). Channex's server returns a 500 Internal Server Error, likely because it cannot process such a large date span in one restriction entry.

From the alert details:
```
{"errors":{"code":"internal_server_error","title":"Internal Server Error"}}
```

All 5 rate plans have `valid_from = null` and `valid_to = null`, so the code falls back to a full 365-day window.

### Fix: Chunk Date Ranges + Add Logging

**File: `supabase/functions/channex-daily-sync/index.ts`**

In the rates section (around line 248), instead of sending one value covering 365 days, break it into **30-day chunks**:

```text
Before (current):
  rateValues = [{ ..., date_from: "2026-02-22", date_to: "2027-02-22", rate: 10800 }]
  // Single API call with 365-day range -> Channex 500

After (fixed):
  rateValues = [
    { ..., date_from: "2026-02-22", date_to: "2026-03-24", rate: 10800 },
    { ..., date_from: "2026-03-24", date_to: "2026-04-23", rate: 10800 },
    // ... 12 chunks total
    { ..., date_from: "2027-01-23", date_to: "2027-02-22", rate: 10800 },
  ]
  // Multiple API calls with 30-day ranges -> Channex 200
```

Also add:
- Detailed logging of the exact payload before each API call
- Log the rate conversion (original value -> cents)
- Skip any chunk where `date_from` is in the past

**File: `supabase/functions/channex-push-rates/index.ts`**

Add similar payload logging before the `channexRequest` call so manual rate pushes also show what's being sent.

**File: `supabase/functions/channex-process-sync-queue/index.ts`**

Apply the same 30-day chunking logic to the queue processor's rate handling (lines 192-212), which has the same 365-day fallback pattern.

### Technical Details

Changes to `channex-daily-sync/index.ts`:
- Replace lines 248-254 (single value generation) with a loop that splits the date range into 30-day windows
- Each chunk generates a separate value entry
- All chunks for a rate plan are collected, then pushed in batches of 10 (existing batch logic)

Changes to `channex-process-sync-queue/index.ts`:
- Apply the same chunking at lines 202-212 where `dateFrom`/`dateTo` are calculated

Changes to `channex-push-rates/index.ts`:
- Add `console.log` of the full payload before the `channexRequest` call (line 184-186)
- No chunking needed here since the caller provides specific date ranges

### Summary

| Change | File | Purpose |
|--------|------|---------|
| 30-day date chunking | daily-sync | Avoid 365-day range that causes Channex 500 |
| 30-day date chunking | process-sync-queue | Same fix for trigger-based rate pushes |
| Payload logging | push-rates | Debug manual rate pushes |
| Payload logging | daily-sync | See exact values being sent |

