

## Fix: Full Sync Button — Add Diagnostics and Robust Error Handling

### Investigation Results

- The `channex-full-sync` edge function **works correctly** when called directly (confirmed via test call — returned 200, logged to `channex_sync_logs`)
- The frontend code in both `ConnectionStatus.tsx` and `PropertySync.tsx` looks structurally correct
- The function is deployed and has `verify_jwt = false` in config.toml
- Last user-triggered sync log was Apr 2; no logs from recent clicks

### Likely Root Cause

The `supabase.functions.invoke` call may be failing silently — if it returns `{ data: null, error: null }` (e.g., response parsing issue), the code falls through to `data?.success` which is falsy, showing `toast.error('Full sync failed')` — but this generic message may blend in with other toasts or get dismissed by the loading toast.

### Fix — 2 Files

**File 1: `src/components/channex/ConnectionStatus.tsx`** (runFullSync function, ~line 260)

1. Add `console.log` before the invoke call to confirm it's being reached
2. After the invoke, add `console.log` for both `data` and `error` to see what's returned
3. Handle the `data === null && error === null` edge case explicitly with a descriptive toast
4. Include the property name in error toasts so the user knows which property failed

**File 2: `src/components/channex/PropertySync.tsx`** (fullSyncProperty function, ~line 121)

1. Same diagnostic logging: `console.log` before invoke, log `data`/`error` after
2. Handle `data === null` explicitly: show toast `"Full sync returned no response — check edge function logs"`
3. Improve error toast messages to include more context

### Changes (both files, same pattern)

```typescript
// Before invoke:
console.log('[full-sync] Invoking channex-full-sync for property:', propertyId);

// After invoke:
console.log('[full-sync] Response:', { data, error });

// New null-data guard (before checking data?.success):
if (!data && !error) {
  toast.error('Full sync returned no response. The function may have timed out.');
  return; // or continue for ConnectionStatus loop
}
```

### Summary
- 2 files edited with diagnostic logging + null-response handling
- No edge function changes needed (it's working correctly)
- The console.log lines will make the next failure immediately diagnosable from browser DevTools

