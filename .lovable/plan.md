

## Fix `channex-push-availability` Edge Function Auth Error

### Root Cause
Line 50 calls `supabase.auth.getClaims(token)` — this method **does not exist** in the Supabase JS client v2. It throws a runtime error before any console.log runs, producing the generic "non-2xx status code" error. The edge function logs confirm: only boot messages, no request processing.

### Fix
Replace the broken `getClaims` auth pattern with the working `getUser()` pattern used by other edge functions (e.g., `create-admin-user`).

**In `supabase/functions/channex-push-availability/index.ts` (lines 49-57):**

Replace:
```typescript
const token = authHeader.replace("Bearer ", "");
const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
if (claimsError || !claimsData?.claims) { ... }
const userId = claimsData.claims.sub;
```

With:
```typescript
const { data: { user }, error: userError } = await supabase.auth.getUser();
if (userError || !user) { ... }
const userId = user.id;
```

**Also fix the same issue in `supabase/functions/channex-push-rates/index.ts` (lines 54-62)** — identical broken pattern.

### Better Error Handling in Frontend
Update `BulkAvailabilityEditor.tsx` `handleSaveAllChanges` to parse error details from the response body instead of showing the generic message.

### Files to change
- `supabase/functions/channex-push-availability/index.ts`: Fix auth (3 lines)
- `supabase/functions/channex-push-rates/index.ts`: Fix same auth bug
- `src/components/pms/BulkAvailabilityEditor.tsx`: Improve error toast with response body parsing

