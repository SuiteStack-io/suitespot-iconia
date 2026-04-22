

## Normalize `super_admin` → `admin` at the Auth Source

Stop sprinkling `|| userRole === 'super_admin'` across the codebase. Instead, do the normalization once in `auth.tsx`: store the raw DB role as `systemRole`, and expose `userRole = 'admin'` whenever `systemRole === 'super_admin'`. Every existing `userRole === 'admin'` check then automatically works for super admins. Only `propertyContext` needs to know the truth (because super admins fetch *all* properties, not just assigned ones).

### 1. `src/lib/auth.tsx` — add `systemRole`, normalize `userRole`

- Add new state `systemRole: string | null` storing the raw role from `user_roles` (`'super_admin' | 'admin' | 'manager' | 'front_desk' | 'housekeeping'`).
- Update `fetchUserRole`:
  ```ts
  if (!error && data) {
    setSystemRole(data.role);
    setUserRole(data.role === 'super_admin' ? 'admin' : data.role);
  }
  ```
- Update `signOut` to also clear `systemRole`.
- Update `hasPermission` to use `systemRole` (since `userRole` will already be `'admin'` for super admins, this is mostly defensive — keep it explicit):
  ```ts
  if (systemRole === 'super_admin' || systemRole === 'admin') return true;
  return permissions[permission];
  ```
- Add `systemRole` to `AuthContextType` and to the provider value.
- Remove the temporary `console.log('[auth] hydration complete...')`.

### 2. `src/lib/propertyContext.tsx` — switch the only super-admin branch to `systemRole`

- Destructure `systemRole` from `useAuth()`.
- Replace:
  ```ts
  const isSuperAdmin = userRole === 'super_admin';
  ...
  const isAppAdmin = userRole === 'admin' || userRole === 'super_admin';
  ```
  with:
  ```ts
  const isSuperAdmin = systemRole === 'super_admin';
  const isAppAdmin = systemRole === 'admin' || systemRole === 'super_admin';
  ```
- Add `systemRole` to the `useCallback` dependency array.
- Keep all other logic (admin = all properties, others = scoped via `user_property_access`) unchanged. Crucially, regular `admin` still gets all properties (existing behavior preserved); only the *source variable* changed from `userRole` to `systemRole`.

### 3. Revert frontend `|| userRole === 'super_admin'` additions

In each file, change `(userRole === 'admin' || userRole === 'super_admin')` back to `userRole === 'admin'`, and `userRole !== 'admin' && userRole !== 'super_admin'` back to `userRole !== 'admin'`. Files & lines:

| File | Lines |
|------|-------|
| `src/components/AdminRoute.tsx` | 13 |
| `src/components/SlideMenu.tsx` | 95, 202 |
| `src/components/inbox/ConversationPanel.tsx` | 79 |
| `src/components/settings/PropertyList.tsx` | 18, 19 |
| `src/pages/Index.tsx` | 152 |
| `src/pages/Analytics.tsx` | 149, 155 |
| `src/pages/AlmazaBay.tsx` | 265, 1469 |
| `src/pages/Commissions.tsx` | 66, 73 |
| `src/pages/GuestForms.tsx` | 103 |
| `src/pages/GuestInbox.tsx` | 65 |
| `src/pages/Guests.tsx` | 67 |
| `src/pages/Users.tsx` | 48, 54, 189 |
| `src/pages/front-desk/RoomRates.tsx` | 73 |

### 4. Revert Edge Function additions

Edge functions don't have access to the React context, so the normalization doesn't apply there. **Keep the super_admin checks in edge functions** — they read `user_roles.role` directly from the DB, where the value is still `'super_admin'`. Reverting these would break Youssef's notifications and admin-gated edge function calls.

Files left unchanged (intentionally):
- `supabase/functions/send-{checkin,checkout,late-checkout,room-change,cancellation,reservation,modification,extension}-notification/index.ts`
- `supabase/functions/send-mid-stay-cleaning-notifications/index.ts`
- `supabase/functions/auto-shuffle-rooms/index.ts`
- `supabase/functions/generate-daily-summary/index.ts`
- `supabase/functions/channex-sync-property/index.ts`
- `supabase/functions/channex-reset-sync/index.ts`

### 5. Out of scope (no change)
- DB enum, `user_roles` row for Youssef, RLS policies, `auto_assign_property_admin` trigger — all stay as-is.
- `hasPermission` semantics — already covered super_admin; just refactored to read `systemRole`.

### 6. Memory update
Replace the existing Core rule in `mem://index.md` with: `super_admin is normalized to userRole='admin' in auth.tsx. All frontend checks should use userRole==='admin'. Use systemRole==='super_admin' only when behavior must differ from a regular admin (currently only propertyContext: super_admin sees ALL properties, regular admin sees assigned properties). Edge functions check the raw DB value and must include both 'admin' and 'super_admin' in role checks.`

### Verification
1. Youssef login → `systemRole='super_admin'`, `userRole='admin'`. SlideMenu shows everything; Commissions/Analytics/Users/Rooms all open. PropertyContext fetches every property; no red banner.
2. Ahmed login → `systemRole='admin'`, `userRole='admin'`. Behavior identical to before. Sees all properties (regular admins already fetched all properties via the existing `isAppAdmin` branch — preserved).
3. Manager / front_desk / housekeeping → `systemRole === userRole`, scoped via `user_property_access`. Unchanged.
4. Edge functions still grant super_admin global access via raw DB role check.
5. Codebase grep for `userRole === 'super_admin'` returns hits only in `src/lib/auth.tsx`.

