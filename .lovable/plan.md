

## Fix: 406 Errors on user_permissions + Full Sync Button Diagnostics

### Root Cause Analysis

The `user_permissions` table exists, but the query in `src/lib/auth.tsx` (line 122) uses `.single()` which returns a 406 error when the admin user has no row in `user_permissions`. This is cosmetic noise — the code handles it — but it creates 406 errors in the network tab on every page load.

The Full Sync button code in `PropertySync.tsx` has the correct `console.log` and invoke call. The button only renders when `isSynced` is true (line 269). There's no permissions gate blocking it. However, the user reports the console.log never fires, suggesting the click handler may not be reaching `fullSyncProperty` — possibly due to a React rendering issue or event propagation problem.

### Fix — 2 Changes

#### 1. Fix 406 errors: Change `.single()` to `.maybeSingle()` in auth.tsx (line 123)

**File: `src/lib/auth.tsx`**, line 123

Change:
```typescript
.single();
```
To:
```typescript
.maybeSingle();
```

This eliminates the 406 error when no `user_permissions` row exists for the user. `.maybeSingle()` returns `{ data: null, error: null }` for 0 rows instead of a 406 error. The existing `if (!error && data)` check handles this correctly.

#### 2. Add click-level logging to PropertyCard's Full Sync button

**File: `src/components/channex/PropertySync.tsx`**, PropertyCard component (~line 270)

Wrap the `onFullSync` call with a logging wrapper to confirm the click event reaches the handler:

```typescript
onClick={() => {
  console.log('[full-sync] Full Sync button clicked for property:', property.id, property.name);
  onFullSync();
}}
```

This will confirm whether the issue is at the button click level or deeper in the invoke call.

### Summary
- 1 line change in `auth.tsx`: `.single()` → `.maybeSingle()` (eliminates 406 errors)
- 1 line change in `PropertySync.tsx`: add click-level console.log on Full Sync button
- No edge function changes needed

