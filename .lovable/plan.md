I’ll add diagnostic logging to `supabase/functions/calculate-dynamic-price-batch/index.ts` only.

Implementation plan:

1. Confirm imports and helper exports
   - Keep the helper path as `../_shared/dynamic-pricing.ts`, which matches `supabase/functions/_shared/dynamic-pricing.ts`.
   - Confirmed `calculateDynamicRate`, `computeMonthPhase`, and `DynamicPricingContext` are exported from the shared helper.
   - This batch function currently imports only `calculateDynamicRate` and `DynamicPricingContext`, so I will not add unused imports.

2. Add boot/import diagnostics
   - Because static ES imports cannot literally be placed inside a synchronous `try { import ... } catch { ... }` block, I’ll use top-level dynamic imports with `await import(...)` so import failures can be logged before rethrowing.
   - Add:
     - `[batch] Imports loaded successfully`
     - `[batch] Import failed:` with the caught import error
   - Preserve the same imported values and types needed by the file.

3. Wrap the entire request handler body
   - Move all handler logic, including the OPTIONS preflight branch and client creation, inside one `try/catch` so runtime failures are logged consistently.
   - Add `[batch] Function started` immediately when the handler runs.
   - Add `[batch] CORS preflight handled` before returning for OPTIONS requests.

4. Add step-by-step logs without changing logic
   - Add the requested `[batch]` logs after each existing operation:
     - body parsed
     - property loaded
     - rate plan validated
     - price row loaded
     - pricing rules loaded
     - units loaded
     - reservations loaded
     - overrides loaded
     - promotions loaded
     - date-loop range and day count
     - loop completed
     - returning success response
   - Log only safe operational details: ids, counts, timezone, non-secret row values already used for pricing.
   - Do not log credentials or environment variable values.

5. Improve fatal error reporting
   - Replace the current generic catch log with:
     - `console.error('[batch] FATAL ERROR:', err.message)`
     - `console.error('[batch] Stack:', err.stack)`
     - `console.error('[batch] Error name:', err.name)`
   - Return `500` with `{ success: false, error: err.message }` so the client receives the actual runtime error.

6. Keep behavior unchanged
   - No query changes.
   - No calculation changes.
   - No response shape changes for successful requests.
   - No auth, validation, or database changes.
   - No duplicate variable declarations in the same scope.