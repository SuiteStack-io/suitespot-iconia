

## Problem Analysis

The "Add Property" button is missing because of two restrictions working together:

1. **Frontend**: `PropertyList.tsx` only renders the "Add Property" button when `isSystemAdmin` is `true` (line 47). This flag comes from `profiles.is_system_admin`, which is a special super-admin flag -- not the same as having the `admin` app_role.

2. **Database RLS**: The `properties` SELECT policy only returns properties to users who either have a `user_property_access` record for that property OR are a system admin. If your current user is an `admin` role but NOT flagged `is_system_admin` in `profiles`, and has no `user_property_access` rows, they see zero properties and no create button.

This creates a chicken-and-egg problem: you need to be a system admin to create the first property, but system admin is a separate flag from the admin role.

## Plan

### 1. Update RLS: Let admin-role users view all properties

Add a new SELECT policy (or amend the existing one) so users with the `admin` app_role can view all properties, not just ones they have explicit access to.

```sql
-- Drop and recreate the SELECT policy
DROP POLICY IF EXISTS "Users can view assigned properties" ON public.properties;
CREATE POLICY "Users can view assigned properties" ON public.properties
  FOR SELECT TO authenticated
  USING (
    public.has_property_access(auth.uid(), id)
    OR public.is_system_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );
```

### 2. Update Frontend: Let admin-role users create properties

In `PropertyList.tsx`, change the create button visibility from `isSystemAdmin` only to also allow users with the `admin` role. The `useAuth` hook already provides `userRole`.

Changes to `PropertyList.tsx`:
- Import `useAuth` from `@/lib/auth`
- Add `const { userRole } = useAuth();`
- Compute `const canCreate = isSystemAdmin || userRole === 'admin';`
- Replace all `isSystemAdmin` checks for the "Add Property" button with `canCreate`
- Keep delete gated on `isSystemAdmin || propertyRole === 'owner'` (already handled via `canDeleteProperty` from context)

### 3. Update Frontend: Let admin-role users edit/delete too

The edit button is already always visible. The delete button checks `isSystemAdmin && !property.is_default` -- change this to also allow admin-role users who are property owners.

No additional file changes needed beyond `PropertyList.tsx`.

---

### Technical Details

**Database migration** (1 SQL statement):
- Drop and recreate the `"Users can view assigned properties"` SELECT policy on `properties` to include `has_role(auth.uid(), 'admin')`.

**Frontend change** (`PropertyList.tsx`):
- Import `useAuth`
- Add `canCreate` computed boolean
- Gate "Add Property" button and empty-state create button on `canCreate` instead of just `isSystemAdmin`

