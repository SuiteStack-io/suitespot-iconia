

## Plan: Property Access Control per User

### Current State
- `user_property_access` table exists with roles (owner/admin/manager/staff/viewer) and proper RLS
- `PropertyAccessSection` already exists in the EditPermissionsDialog — admins can assign/remove property access per user
- `PropertyProvider` fetches ALL properties regardless of user access
- `PropertySwitcher` shows all active properties
- `auto_assign_property_owner` trigger grants owner role to property creator

### What Needs to Change

#### 1. Filter Properties by User Access in PropertyProvider
**File: `src/lib/propertyContext.tsx`**
- For non-admin users: fetch only properties where the user has a `user_property_access` row, by first querying `user_property_access` for the user's property IDs, then filtering the properties query
- For admin users / system admins: continue fetching all properties (admins have unrestricted access)
- If a non-admin user has zero accessible properties, set an `accessDenied` flag in context

#### 2. Update PropertySwitcher for Empty State
**File: `src/components/PropertySwitcher.tsx`**
- When `properties` is empty and user is not admin, show "No properties assigned. Contact your administrator." message instead of hiding the switcher

#### 3. Database: Auto-grant Property Access to All Admins on New Property Creation
**Migration** — Create a trigger on `properties` INSERT that inserts a `user_property_access` row for every user with the `admin` app_role, granting them `admin` property role on the new property.

#### 4. No Other Changes Needed
- The `PropertyAccessSection` in EditPermissionsDialog already provides the UI for admins to manage per-user property access with role selection
- RLS on `units`, `reservations`, `rate_plans` already uses `user_has_property_access()` which validates property-level access
- localStorage persistence of last selected property already works
- If a user switches to a property they lost access to, the filtered list simply won't include it and the provider will fall back to the first accessible property

