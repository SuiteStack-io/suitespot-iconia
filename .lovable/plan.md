

## Fix: Super Admin Sees No Properties

The super_admin user's banner ("No properties assigned") appears because the `properties` table RLS SELECT policy doesn't include `super_admin`. Even though the client code attempts to fetch all properties for super admins, the database silently returns 0 rows.

### 1. Database — add `super_admin` to the SELECT policy on `properties`

New migration:

```sql
DROP POLICY IF EXISTS "Users can view assigned properties" ON public.properties;

CREATE POLICY "Users and admins can view properties"
ON public.properties
FOR SELECT
USING (
  has_property_access(auth.uid(), id)
  OR is_system_admin(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);
```

This matches the pattern already used in the UPDATE/DELETE policies after the previous migration.

### 2. `src/lib/propertyContext.tsx` — clean up the fetch branch

Refactor `fetchProperties` to use the `isSuperAdmin` flag from `useAuth()` (single source of truth) instead of re-querying `user_roles` locally:

- Read `userRole` from `useAuth()` (already destructured).
- `const isSuperAdmin = userRole === 'super_admin'` (already exists at line 81).
- Branch:
  - **Super admin** → `supabase.from('properties').select('*').order('is_default', { ascending: false }).order('name')` — no `user_property_access` filter.
  - **System admin OR `admin` app_role** → same direct fetch (existing behavior).
  - **Everyone else** → existing `user_property_access` join.
- Drop the now-redundant local `user_roles` query (lines 103-111). Use `userRole` from auth context instead.

Result: super admins see all properties without needing any `user_property_access` row, and the banner will not appear because `properties` will be populated.

### 3. PropertySwitcher banner — no code change required

The "No properties assigned" banner is rendered only when `activeProperties.length === 0`. Once RLS + fetch return all properties for super_admin, the array is non-empty and the banner naturally disappears. No change to `PropertySwitcher.tsx` needed.

### Out of scope
- No changes to how `admin`, `manager`, `front_desk`, `housekeeping`, `staff` fetch properties.
- No changes to `PropertySwitcher` UI.
- No rows added to `user_property_access` for the super_admin user.
- No changes to other RLS policies.

### Verification
1. Super admin login → property dropdown shows all properties; no red banner.
2. `SELECT` on `properties` from super admin session returns all rows.
3. Ahmed (`admin` app_role) → unchanged, still sees all properties.
4. Manager / staff users → unchanged, still scoped via `user_property_access`.
5. `user_property_access` still contains zero rows for the super_admin user.

