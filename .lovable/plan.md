

## Promote `owner` → System `super_admin` Role

Replace the property-scoped `owner` role with a new system-level `super_admin` app_role for the Hostbase platform operator. `admin` stays unchanged.

### 1. Database migration

**Enum + helper functions**
- `ALTER TYPE public.app_role ADD VALUE 'super_admin';` (must run in its own statement before any usage).
- Update `public.user_has_property_access(...)` — drop `'owner'` from each role-array branch, drop the `WHEN 'owner'` arm. Add an early-return for `has_role(auth.uid(), 'super_admin'::app_role)`.
- Update `public.is_system_admin(...)` (or add a parallel check) so super_admins are treated as system admins. Simplest: keep `is_system_admin` as-is (profiles flag) and have all RLS use `has_role(..., 'super_admin')` alongside it.

**Trigger**
- `DROP TRIGGER trigger_auto_assign_property_owner ON public.properties;`
- `DROP FUNCTION public.auto_assign_property_owner();`
- Replace with a new trigger function `auto_assign_property_admin` that inserts the creator as `'admin'` (property-scoped) — only if the creator is NOT a super_admin (super_admins don't need a row to access).

**RLS policies (rewrite, drop `owner` everywhere)**
- `properties` — "Property owners and admins can update": replace with `has_property_role(auth.uid(), id, ARRAY['admin']) OR has_role(auth.uid(),'super_admin') OR is_system_admin(auth.uid())`.
- `properties` — "Admins can update properties": same swap (drop `'owner'` from array, add `super_admin`).
- `properties` — "Property owners can delete": rename concept to "Super admins and system admins can delete", remove `'owner'`. Property-level `admin` does NOT get delete (deletion is now reserved for super_admin / is_system_admin).
- `user_property_access` SELECT/INSERT/UPDATE/DELETE — drop `'owner'` from arrays, leave `'admin'`, add `has_role(...,'super_admin')`.

**Data updates (via insert tool)**
- `UPDATE public.user_roles SET role = 'super_admin' WHERE user_id = 'd540b87e-f856-4ef1-9193-2fb077366ef9';`
- `DELETE FROM public.user_property_access WHERE role = 'owner';` (only Youssef's row).

### 2. `src/lib/auth.tsx`
- `PropertyRole` type → `'admin' | 'manager' | 'staff' | 'viewer'` (drop `'owner'`).
- `hasPermission`:
  ```ts
  if (userRole === 'super_admin') return true;
  if (userRole === 'admin') return true;
  return permissions[permission];
  ```
- `propertyRole` state stays (still surfaced to consumers like `propertyContext`/`AdminRoute`); we just no longer compare it to `'owner'`.

### 3. `src/components/AdminRoute.tsx`
```ts
const { userRole, loading } = useAuth();
const allowed = userRole === 'super_admin' || userRole === 'admin';
```
Drop `propertyRole` from the destructure.

### 4. `src/lib/propertyContext.tsx`
- `PropertyRole` type → `'admin' | 'manager' | 'staff' | 'viewer'`.
- Add `isSuperAdmin` derived from `userRole === 'super_admin'` (read from auth context — convert provider to consume `useAuth().userRole`).
- Update derivations:
  ```ts
  const canEditProperty   = isSystemAdmin || isSuperAdmin || propertyRole === 'admin';
  const canDeleteProperty = isSystemAdmin || isSuperAdmin;             // owner-only action moves to super_admin
  const canManageUsers    = isSystemAdmin || isSuperAdmin || propertyRole === 'admin';
  ```
- In `fetchProperties`, treat super_admins like the existing system-admin branch (fetch all properties, skip access filter). Update the local `isAppAdmin` check to also include `super_admin`.

### 5. UI components
- `src/components/settings/ManagePropertyUsersDialog.tsx`
  - `ROLES: PropertyRole[] = ['admin', 'manager', 'staff', 'viewer']`.
  - Remove the `.filter(r => r !== 'owner')` line — no longer needed; render full list in the add dropdown.
- `src/components/PropertyAccessSection.tsx`
  - `ROLES = ['admin', 'manager', 'staff', 'viewer'] as const`.

### 6. Out of scope (per instructions)
- `admin` app_role behavior, Ahmed's role, `manager`/`front_desk`/`housekeeping`, granular permissions, edge functions — all unchanged.

### Verification
1. Youssef (`super_admin`) → `hasPermission(...)` returns true; `AdminRoute` allows; `propertyContext` lists every property.
2. Ahmed (`admin`) → unchanged behavior; full access to ICONIA.
3. Creating a new property as Ahmed → trigger auto-assigns him as `user_property_access.role = 'admin'` (not `owner`).
4. Codebase grep for `'owner'` as a role returns zero matches in `src/`.
5. `SELECT * FROM user_property_access WHERE role = 'owner'` returns zero rows.

