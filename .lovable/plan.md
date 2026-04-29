# Diagnose `channex-update-property-settings` failures

## Findings so far

### 1. Sync logs query result

Only **one** row exists for this function in `channex_sync_logs`:

| created_at | status_code | success | settings sent |
|---|---|---|---|
| 2026-04-12 10:33:42 UTC | 200 | true | `{min_price: 9000, max_price: 16000}` (cents) |

That call eventually succeeded — Channex returned the property with `min_price: 90.00, max_price: 160.00`.

### 2. Edge function logs

Recent invocations show Channex `PUT /api/v1/properties/...` returning **504 Gateway Timeout** repeatedly, exhausting all 3 retries, then the function shuts down. Two such invocation sequences happened around 10:30 and 10:43 UTC, both with payload `{min_price: 8000, max_price: 16000}`.

### 3. Why failed attempts don't appear in `channex_sync_logs`

The catch block at line 146 calls `await req.clone().json().catch(() => ({}))`, but in some runtimes the request body may already be consumed/locked by the time we reach the catch (the body is parsed at line ~70 with `await req.json()`). Combined with the outer `try { ... } catch (_logErr) { /* ignore */ }`, **any failure to log is silently swallowed**, so 504s from Channex never produce a sync_log row. That's why the user sees "non-2xx" client-side but the DB shows nothing.

### 4. Root cause hypothesis

The `min_price: 8000` (= 80 USD) attempts on retry could in principle be rejected by Channex with a validation error, but the actual symptom in logs is **504 timeout**, not a 4xx. So the immediate issue is Channex API latency/timeouts on `PUT /api/v1/properties/...`. The successful 9000/16000 push at 10:33 confirms the payload structure itself is fine.

We need richer logging to confirm the failure mode on the next user-triggered retry.

---

## Plan

Add detailed logging to `supabase/functions/channex-update-property-settings/index.ts` **without changing any logic** (auth, validation, payload structure all preserved). Also fix the silent log-loss so failures actually persist to `channex_sync_logs`.

### Changes

1. **Capture parsed body in an outer-scope variable** so the catch block can log the real payload instead of trying to re-parse a consumed request.
   - Declare `let parsedBody: any = null;` and `let resolvedChannexId: string | null = null;` before the `try` block (single declaration each — no duplicates).
   - Assign `parsedBody = await req.json();` inside `try`.
   - Assign `resolvedChannexId = mapping.channex_id;` after the mapping lookup.

2. **Add console.log statements at every step** (info-level via `console.log`, errors via `console.error`):
   - `[diag] Request received` with method + URL.
   - `[diag] Authenticated user: <user.id>`.
   - `[diag] Admin check passed`.
   - `[diag] Parsed body:` with `{ property_id, min_price, max_price }`.
   - `[diag] Channex mapping lookup result:` with `mapping` row or null.
   - `[diag] Resolved Channex property ID: <id>`.
   - `[diag] Built settings payload (cents):` with the `settings` object.
   - `[diag] Full Channex payload:` with `JSON.stringify(channexPayload)`.
   - `[diag] Calling Channex PUT /api/v1/properties/<id>` with timestamp.
   - `[diag] Channex response (success):` with `JSON.stringify(response).slice(0, 2000)` to avoid huge logs.
   - `[diag] logSync (success) inserted`.
   - In catch: `console.error('[diag] Caught error:', err.message)` plus `console.error('[diag] Error stack:', err.stack)` plus `console.error('[diag] Error name:', err.name, 'statusCode:', err.statusCode)` (the `ChannexApiError` from `_shared/channex-client.ts` carries `statusCode`).

3. **Fix the failure-logging path** so 504s actually appear in `channex_sync_logs`:
   - Replace `await req.clone().json().catch(() => ({}))` with `parsedBody ?? {}`.
   - Use `resolvedChannexId` (or `'/api/v1/properties/*'` fallback) in the endpoint string.
   - Use `parsedBody?.property_id ?? null` for the property_id arg.
   - Include `err.statusCode ?? null` as `status_code` in the failed `logSync` call (currently hardcoded `null`) so we can distinguish 504/4xx/network errors in the DB.
   - Add `console.error('[diag] logSync (failure) attempted with status:', err.statusCode)` right before the call, and `console.error('[diag] logSync (failure) threw:', logErr)` inside the inner catch (rename `_logErr` → `logErr`) so we no longer silently swallow logging errors.

4. **No changes** to:
   - CORS headers
   - Auth/admin check
   - Payload structure (`{ property: { settings: { min_price, max_price } } }` in cents)
   - Return status codes
   - `channexRequest` shared helper

### Verification flow after deploy

1. User retries the sync from the UI.
2. Pull `supabase--edge_function_logs` for `channex-update-property-settings` filtered on `[diag]`.
3. Query `channex_sync_logs` again — failures should now appear with the correct `status_code` (e.g. 504) and a populated `request_payload`.
4. Report findings: payload sent vs Channex response, whether it's a Channex 504 (their side) or a 4xx validation error (our payload), and what `min_price`/`max_price` values are in flight.

### Files touched

- `supabase/functions/channex-update-property-settings/index.ts` (logging only)

No DB migrations, no frontend changes, no shared-helper changes.
