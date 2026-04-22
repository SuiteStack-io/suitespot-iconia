

## Fix Race Condition Causing Super Admin "No Properties Assigned"

### Root cause
The DB and `propertyContext` are correct. The bug is in `src/lib/auth.tsx`:

- `onAuthStateChange` schedules `fetchUserRole / fetchUserPermissions / fetchSystemAdmin / fetchPropertyRole` inside `setTimeout(..., 0)` **without awaiting them**.
- The parallel `getSession()` block flips `loading=false` as soon as *its* `Promise.all` resolves.
- `PropertyProvider`'s effect runs `fetchProperties` the moment `authLoading=false`. On a fresh tab/login this can fire **before `userRole` has been written**, so `userRole` is `null`, the `super_admin` branch is skipped, the user_property_access query returns zero rows, `properties=[]`, and `PropertySwitcher` renders the red banner.

The DB query results confirm the data side is fine:
- `app_role` enum contains `super_admin`.
- `user_roles` for `d540b87e…` returns `role = 'super_admin'` (Youssef Noureldin).
- `properties` SELECT policy: `has_property_access(...) OR is_system_admin(...) OR has_role(..., 'admin') OR has_role(..., 'super_admin')`.

### Changes — `src/lib/auth.tsx` only

1. Add a tracker so `loading` only flips to `false` once role + permissions + system-admin flag are all resolved (for both the initial `getSession` path and the `onAuthStateChange` path).
2. In `onAuthStateChange`, replace the fire-and-forget `setTimeout` with a single async helper that awaits all four fetches via `Promise.all`, then sets `loading=false`.
3. Keep the existing `getSession` path but route it through the same helper to avoid duplicated logic.
4. When the listener reports no session, set `loading=false` immediately.
5. Add a single temporary `console.log('[auth] role resolved:', userRole)` after role fetch to confirm timing during verification, then remove it once the user confirms the fix.

Pseudocode of the new helper:
```ts
const hydrateUser = async (userId: string) => {
  await Promise.all([
    fetchUserRole(userId),
    fetchUserPermissions(userId),
    fetchSystemAdmin(userId),
    fetchPropertyRole(userId),
  ]);
  setLoading(false);
};
```
- `getSession().then(...)` → if session, call `hydrateUser`; else `setLoading(false)`.
- `onAuthStateChange((_e, session) => { ... if (session?.user) hydrateUser(session.user.id); else { reset; setLoading(false); } })`.

### Why this fixes the banner
Once `loading` is guaranteed to be `false` only after `userRole` is set, `PropertyProvider` runs `fetchProperties` with the correct `userRole='super_admin'`, hits the admin branch, and selects all properties (RLS already permits it). `PropertySwitcher` then sees `activeProperties.length > 0` and never renders the red banner.

### Out of scope (already correct, not touched)
- `src/lib/propertyContext.tsx` — fetch logic already handles `super_admin`.
- `properties` RLS policy — already includes `super_admin`.
- `PropertySwitcher.tsx` — banner is correct for the genuine "no access" case (regular users); we just need to stop hitting it spuriously for super_admins.

### Verification
1. Hard reload as Youssef (`super_admin`) → no red banner; property dropdown lists every property.
2. Console shows `[auth] role resolved: super_admin` before any property fetch logs.
3. Ahmed (`admin`) → unchanged; sees all properties.
4. Manager / staff with no `user_property_access` rows → still see the red banner (correct behavior).
5. Sign out, sign back in → role is set before the property fetch runs.

