

## Plan: Complete Property Access Filtering

### 1. Update PropertyProvider to filter by access
**File: `src/lib/propertyContext.tsx`**
- After checking `is_system_admin` and `has_role('admin')`, decide the fetch strategy:
  - **Admin/system admin users**: fetch all properties (current behavior)
  - **Non-admin users**: first query `user_property_access` for the user's property IDs, then fetch only those properties using `.in('id', propertyIds)`
- If non-admin user has zero accessible properties, the `properties` array will be empty naturally

### 2. Update PropertySwitcher empty state
**File: `src/components/PropertySwitcher.tsx`**
- When `properties` is empty and `isLoading` is false, show: "No properties assigned. Contact your administrator." instead of returning null
- Check `isSystemAdmin` from context to differentiate admin vs non-admin empty states

### 3. Database trigger: auto-grant admin access on new property
**Migration** -- Create a trigger `trg_auto_grant_admin_property_access` on `properties` INSERT that inserts a `user_property_access` row (role = 'admin') for every user with `admin` app_role in `user_roles`

### Files modified
- `src/lib/propertyContext.tsx` -- access-filtered property fetching
- `src/components/PropertySwitcher.tsx` -- empty state message
- 1 SQL migration -- admin auto-grant trigger

