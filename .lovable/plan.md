

## Bug: Race Condition in Permission Loading

### Root Cause

There is a timing bug in `src/lib/auth.tsx`. On line 80, `setLoading(false)` is called **before** `fetchUserRole` and `fetchUserPermissions` finish (they are async and not awaited). This creates a race condition:

1. `authLoading` becomes `false`
2. `userRole` resolves to `'front_desk'` (fast query, single column)
3. `permissions` are **still defaults** (all `false`) because `fetchUserPermissions` hasn't completed yet
4. The guard in `Guests.tsx` evaluates: `!authLoading && userRole === 'front_desk' && !hasPermission('can_access_front_desk')` → **true** (because permissions are still defaults)
5. User gets redirected to `/admin` before permissions finish loading

This affects all three guarded pages (Guests, GuestForms, RoomRates).

### Fix

**File: `src/lib/auth.tsx`** — Await both `fetchUserRole` and `fetchUserPermissions` before setting `loading` to `false`:

```typescript
// Change lines 73-80 from:
supabase.auth.getSession().then(({ data: { session } }) => {
  setSession(session);
  setUser(session?.user ?? null);
  if (session?.user) {
    fetchUserRole(session.user.id);
    fetchUserPermissions(session.user.id);
  }
  setLoading(false);
});

// To:
supabase.auth.getSession().then(async ({ data: { session } }) => {
  setSession(session);
  setUser(session?.user ?? null);
  if (session?.user) {
    await Promise.all([
      fetchUserRole(session.user.id),
      fetchUserPermissions(session.user.id),
    ]);
  }
  setLoading(false);
});
```

This ensures `loading` stays `true` until both the role and permissions are fully loaded, preventing the premature redirect.

### Files Changed

| File | Change |
|------|--------|
| `src/lib/auth.tsx` | Await role + permissions fetch before setting loading=false |

