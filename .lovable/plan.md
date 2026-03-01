

## Phase 4 Assessment: RLS Policies for Multi-Property Support

### Already Implemented

The database already has significant RLS infrastructure:

1. **`user_property_access` table** -- Full RLS with policies for SELECT, INSERT, UPDATE, DELETE using `has_property_role()` and `is_system_admin()` security definer functions
2. **Helper functions** -- `has_property_access()`, `has_property_role()`, and `is_system_admin()` already exist as `SECURITY DEFINER` functions
3. **`properties` table** -- Has RLS policies (not shown in the provided schema dump, but referenced by the context and `propertyContext.tsx` which queries it successfully)

### What Needs to Change

The spec references tables that don't exist in the current schema (`rooms`, `rate_plan_date_restrictions`, `channex_bookings`). The actual tables are `units`, `rate_plan_restrictions`, and bookings come through `reservations`. Let me map the spec to reality:

#### Tables needing property-scoped RLS updates:

1. **`units`** (spec calls them "rooms") -- Currently has simple role-based RLS (`has_role(auth.uid(), 'admin')` for ALL, `true` for SELECT). Needs property-scoped policies using `property_id` column.

2. **`reservations`** -- Currently uses role-based RLS. Has `property_id` column. Needs property-scoped policies, but must preserve public access policies for guest check-in and website bookings.

3. **`rate_plans`** -- Currently uses role-based RLS. Has `property_id` column. Needs property-scoped policies.

4. **`rate_plan_restrictions`** -- No `property_id` column; linked via `rate_plan_id`. Needs join-based property scoping.

5. **`channex_sync_logs`** -- Has `property_id` column. Currently admin-only. Could scope to property access.

6. **`channex_mappings`** -- No `property_id` column; linked via `local_id`. Currently admin-only. Lower priority.

#### New helper function:

Create `user_has_property_access(property_uuid UUID, required_role TEXT DEFAULT NULL)` with role hierarchy logic as specified. This complements the existing `has_property_access` (boolean check) and `has_property_role` (exact role array check) by adding role hierarchy.

### Implementation Plan

#### Step 1: Create the role-hierarchy helper function

```sql
CREATE OR REPLACE FUNCTION public.user_has_property_access(
  property_uuid UUID, 
  required_role TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF is_system_admin(auth.uid()) THEN RETURN TRUE; END IF;
  IF required_role IS NULL THEN
    RETURN has_property_access(auth.uid(), property_uuid);
  END IF;
  RETURN has_property_role(auth.uid(), property_uuid,
    CASE required_role
      WHEN 'viewer' THEN ARRAY['owner','admin','manager','staff','viewer']
      WHEN 'staff' THEN ARRAY['owner','admin','manager','staff']
      WHEN 'manager' THEN ARRAY['owner','admin','manager']
      WHEN 'admin' THEN ARRAY['owner','admin']
      WHEN 'owner' THEN ARRAY['owner']
    END
  );
END;
$$;
```

#### Step 2: Update `units` RLS policies

Drop existing permissive policies, replace with:
- SELECT: `user_has_property_access(property_id)` OR `property_id IS NULL` (for legacy/unassigned)
- INSERT/UPDATE/DELETE for managers+: `user_has_property_access(property_id, 'manager')`
- Keep a public SELECT for unauthenticated access if needed (booking flow)

#### Step 3: Update `reservations` RLS policies

Drop role-only policies, replace with property-scoped ones while **preserving**:
- Public SELECT for confirmed/checked-in (guest check-in flow)
- Public INSERT for direct website bookings
- Service role bypass for webhooks

New policies:
- Authenticated SELECT: `user_has_property_access(property_id)`
- INSERT for staff+: `user_has_property_access(property_id, 'staff')`
- UPDATE for staff+: same
- DELETE for admins: `user_has_property_access(property_id, 'admin')`

#### Step 4: Update `rate_plans` RLS policies

Has `property_id` column directly. Replace current role-based with:
- SELECT: `user_has_property_access(property_id)` (plus public for booking flow)
- ALL for managers+: `user_has_property_access(property_id, 'manager')`

#### Step 5: Update `rate_plan_restrictions` RLS policies

No direct `property_id`. Use join through `rate_plans`:
- SELECT/ALL: `EXISTS (SELECT 1 FROM rate_plans WHERE rate_plans.id = rate_plan_id AND user_has_property_access(rate_plans.property_id, ...))`

#### Step 6: Update `channex_sync_logs` RLS policies

Has `property_id`. Scope SELECT to property access instead of admin-only.

### Migration SQL

One migration with:
1. Create `user_has_property_access` function
2. Drop and recreate policies on `units`, `reservations`, `rate_plans`, `rate_plan_restrictions`, `channex_sync_logs`
3. Preserve public/anonymous access paths that existing features depend on
4. Preserve system INSERT policies (service role for webhooks, triggers)

### Risk Mitigations

- **Webhook/trigger writes**: Edge functions use service role key, bypassing RLS -- no impact
- **Guest check-in flow**: Public SELECT on reservations for confirmed status preserved
- **Website booking flow**: Public INSERT on reservations for `source = 'direct website'` preserved
- **`property_id IS NULL` records**: Legacy data with null property_id needs fallback -- policies will include `OR property_id IS NULL` for SELECT to avoid breaking existing views
- **Performance**: `user_has_property_access` calls existing `SECURITY DEFINER` functions that do simple EXISTS queries -- minimal overhead

### No Frontend Changes Required

The frontend already filters by `activeProperty.id` via `usePropertyFilter`. RLS adds server-side enforcement as a security layer.

