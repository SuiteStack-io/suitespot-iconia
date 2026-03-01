

## Plan: Add Property Access to the Permissions Dialog

### What changes

The `EditPermissionsDialog` currently only manages granular permission toggles (can_check_in, can_check_out, etc.). The user wants property access management (currently in `ManagePropertyUsersDialog` on the Settings page) to also appear inside this dialog.

### Implementation

#### 1. Extend `EditPermissionsDialog` with a "Property Access" section

Add a new section below the permission toggles that shows which properties the user has access to and their role for each. This section will:

- Fetch from `user_property_access` joined with `properties` for the selected user
- Display each property with a role dropdown (owner/admin/manager/staff/viewer)
- Allow adding access to properties the user doesn't have yet
- Allow removing property access
- Use the same `properties` table data already available

#### 2. Files to modify

**`src/components/EditPermissionsDialog.tsx`**:
- Add state for property access records and available properties
- Fetch `user_property_access` + `properties` when dialog opens
- Add a "Property Access" section with:
  - List of assigned properties with role selector and remove button
  - "Add Property" dropdown to grant access to new properties
- Handle add/update/remove operations on `user_property_access`
- Save property access changes alongside permission changes

#### 3. No other files need changes

The `ManagePropertyUsersDialog` and its usage in `PropertyList.tsx` remain untouched — property access can still be managed from Settings too. The permissions dialog simply becomes another entry point for the same data.

### Technical Details

The property access section will query:
```typescript
// Fetch user's property access
const { data } = await supabase
  .from('user_property_access')
  .select('id, property_id, role')
  .eq('user_id', user.id);

// Fetch all properties for the dropdown
const { data: properties } = await supabase
  .from('properties')
  .select('id, name');
```

RLS already permits admins to read/write `user_property_access`, so no database changes are needed.

