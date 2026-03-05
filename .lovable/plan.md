

## Fix Channex Sync Logs: Full Request Payload and Raw Response with Task IDs

### Analysis

After reviewing all Channex sync edge functions, I found two functions with incomplete logging:

1. **`channex-push-restrictions`** — The main offender. Logs `{ count: values.length }` as request payload and `{ summary }` as response. Both lose critical data.

2. **`channex-full-sync`** — Its `rawChannexPost` helper discards the full Channex response, only extracting the task ID. The log records a summary object instead of raw responses.

The other functions (`channex-push-rates`, `channex-push-availability`, `channex-sync-rates`, `channex-process-sync-queue`) already log the full `channexPayload` and raw `response` correctly.

### Changes

#### 1. `supabase/functions/channex-push-restrictions/index.ts`

- Collect all batch responses into an array (`allResponses`)
- Store each raw Channex response from `channexRequest` into `allResponses`
- Change `logSync` call (line 121-130):
  - `request_payload`: from `{ count: values.length }` → `{ values }` (full payload)
  - `response_payload`: from `{ summary }` → `{ summary, channex_responses: allResponses }` (raw responses with task IDs + summary)

#### 2. `supabase/functions/channex-full-sync/index.ts`

- Update `rawChannexPost` helper to return the full raw response data alongside the task ID
- Accumulate all raw responses per sync type (availability + rates)
- Change `logSync` call (lines 325-339):
  - `request_payload`: add `{ propertyId, days: SYNC_DAYS, room_types: [...], rate_plans: [...] }` (list of what was synced)
  - `response_payload`: include the raw Channex responses alongside the existing task ID arrays

### No database or frontend changes needed

