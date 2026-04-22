

## Auto-Grant All Permissions to Property Owners

Property owners are currently locked out of most features because `hasPermission()` only short-circuits for system `admin`. This change extends that shortcut to property `owner` for the currently active property, and opens `AdminRoute` to owners as well.

### 1. Expose `propertyRole` in `AuthContext` — `src/lib/auth.tsx`

- Add `propertyRole: PropertyRole | null` to `AuthContextType`.
- After the existing `fetchUserRole` / `fetchUserPermissions` / `fetchSystemAdmin` calls, fetch the user's property role:
  - Read the active property id from `localStorage.getItem('activePropertyId')` (the same key `PropertyProvider` uses).
  - If a saved id exists, query `user_property_access` for `(user_id, property_id)` → set `propertyRole` to `data.role` (or `null`).
  - If no saved id, look up the user's first/default access row (single result) and use that role; fall back to `null`.
- Listen for active-property changes so the role stays in sync:
  - Add a `window` event `activePropertyChanged` (CustomEvent with `propertyId`). The auth provider re-fetches the role on this event.
  - In `src/lib/propertyContext.tsx`, dispatch this event inside `setActiveProperty` and at the end of `fetchProperties` once the active property is resolved. (No structural change to `PropertyProvider`; just a `window.dispatchEvent` call.)
- On `signOut`, clear `propertyRole` to `null`.

### 2. Extend the `hasPermission` shortcut — `src/lib/auth.tsx`

```ts
const hasPermission = (permission: keyof UserPermissions): boolean => {
  if (userRole === 'admin') return true;
  if (propertyRole === 'owner') return true;
  return permissions[permission];
};
```

The existing admin behavior is preserved verbatim; owner is added as a second short-circuit.

### 3. Open `AdminRoute` to property owners — `src/components/AdminRoute.tsx`

- Pull `propertyRole` from `useAuth()`.
- Replace the gate:
  ```ts
  if (!loading && userRole !== 'admin' && propertyRole !== 'owner') {
    navigate('/admin', { replace: true });
  }
  ```
- Mirror the same condition in the render-null guard.

### 4. Type definition

Add a `PropertyRole` type alias inside `src/lib/auth.tsx` (`'owner' | 'admin' | 'manager' | 'staff' | 'viewer'`) so we don't import from `propertyContext` and create a circular dependency. The string union is intentionally duplicated (both files already declare it independently).

### Out of scope (per instructions)
- No changes to `user_permissions` table, granular permissions, RLS, edge functions, or the owner auto-assign trigger.
- No changes to the "Add user to property" dropdown (owner stays auto-assign only).
- No changes to `front_desk` / `manager` / `housekeeping` / `staff` behavior.
- No changes to hardcoded `userRole === 'admin'` checks elsewhere — those are tracked separately and follow the granular-permissions migration pattern. Owners now pass `hasPermission(...)` checks automatically; pages still gated by raw `userRole === 'admin'` will be addressed in follow-up work.

### Verification
1. New user, no system role, `owner` of a test property → `hasPermission('can_delete_reservation')` and `hasPermission('can_view_revenue')` both return `true`; can access `AdminRoute`-gated pages.
2. `manager` (not owner) → still gated by granular permissions only.
3. System `admin` → unchanged behavior.
4. Switching active property in `PropertySwitcher` updates `propertyRole` immediately (event-driven re-fetch).
5. Sign out clears `propertyRole`.

