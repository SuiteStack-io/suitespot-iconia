

# Plan: Multi-Property Support — Phase 1

## Overview

This is a foundational infrastructure change that touches nearly every part of the system. To avoid breaking the existing single-property workflow, this plan implements Phase 1: the database tables, Settings UI for managing properties, user-property access, and a property context provider. Wiring all existing pages (rooms, reservations, rates, etc.) to be property-aware is Phase 2.

---

## Current State

- A single property ("ICONIA Zamalek") is configured via the `channex_property_config` table
- The `units` table has a `location` column (e.g. `'ICONIA'`) but no `property_id` foreign key
- The `profiles` table has `id`, `full_name`, `created_at`, `updated_at` — no `is_system_admin` column
- The Settings page at `/settings` is an empty placeholder
- Auth context provides `userRole` (from `user_roles` table) and granular `permissions` (from `user_permissions` table)

---

## Database Migration

### 1. `properties` table

```sql
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  description TEXT,
  property_type TEXT DEFAULT 'hotel',
  email TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  address TEXT NOT NULL,
  address_line_2 TEXT,
  city TEXT NOT NULL,
  state TEXT,
  zip_code TEXT,
  country TEXT NOT NULL DEFAULT 'EG',
  latitude NUMERIC(10,8),
  longitude NUMERIC(11,8),
  timezone TEXT NOT NULL DEFAULT 'Africa/Cairo',
  currency TEXT NOT NULL DEFAULT 'USD',
  default_checkin_time TIME DEFAULT '15:00',
  default_checkout_time TIME DEFAULT '11:00',
  channex_property_id TEXT,
  channex_synced BOOLEAN DEFAULT FALSE,
  channex_last_sync TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Only one default property at a time
CREATE UNIQUE INDEX idx_properties_single_default ON properties (is_default) WHERE is_default = TRUE;

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
```

### 2. `user_property_access` table

```sql
CREATE TABLE public.user_property_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer',
  granted_by UUID REFERENCES public.profiles(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, property_id)
);

CREATE INDEX idx_upa_user ON user_property_access(user_id);
CREATE INDEX idx_upa_property ON user_property_access(property_id);

ALTER TABLE public.user_property_access ENABLE ROW LEVEL SECURITY;
```

### 3. Add `is_system_admin` to `profiles`

```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_system_admin BOOLEAN DEFAULT FALSE;
```

### 4. Auto-assign creator as owner (trigger)

```sql
CREATE OR REPLACE FUNCTION public.auto_assign_property_owner()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.user_property_access (user_id, property_id, role, granted_by)
    VALUES (NEW.created_by, NEW.id, 'owner', NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_auto_assign_property_owner
  AFTER INSERT ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_property_owner();
```

### 5. Ensure single default property (trigger)

```sql
CREATE OR REPLACE FUNCTION public.ensure_single_default_property()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    UPDATE public.properties SET is_default = FALSE WHERE id != NEW.id AND is_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_ensure_single_default_property
  BEFORE INSERT OR UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_default_property();
```

### 6. RLS Policies

**properties:**
- SELECT: user has access via `user_property_access` OR `is_system_admin` on profiles
- INSERT: any admin (from `user_roles`) or system admin
- UPDATE: user has 'owner' or 'admin' role on that property, or is system admin
- DELETE: user has 'owner' role on that property, or is system admin

**user_property_access:**
- SELECT: user can see rows for properties they have access to, or is system admin
- INSERT: user has 'owner' or 'admin' role on that property, or is system admin
- UPDATE: user has 'owner' or 'admin' role on that property, or is system admin
- DELETE: user has 'owner' or 'admin' role on that property, or is system admin

All policies will use security definer helper functions to avoid recursion.

### 7. Seed existing ICONIA Zamalek

After migration, use the data insert tool to:
- Create the ICONIA Zamalek property record with `is_default = TRUE`, pulling data from `channex_property_config`
- Set the current admin user as `is_system_admin = TRUE` on their profile
- The trigger will auto-assign them as owner

---

## New Files to Create

### `src/lib/propertyContext.tsx`
React context providing:
- `properties: Property[]` — all properties user can access
- `activeProperty: Property | null` — currently selected property
- `setActiveProperty(property)` — switch active property (persists to localStorage)
- `propertyRole: string | null` — user's role on active property
- `isSystemAdmin: boolean`
- Permission helper booleans: `canEditProperty`, `canDeleteProperty`, `canManageUsers`, etc.
- CRUD functions: `createProperty`, `updateProperty`, `deleteProperty`

### `src/components/PropertySwitcher.tsx`
Dropdown in the SlideMenu header area showing available properties with a star for the default. Clicking switches the active property context.

### `src/components/settings/PropertyList.tsx`
Card-based list of all properties the user can access, with actions (Edit, Manage Users, Delete, Set as Default).

### `src/components/settings/PropertyForm.tsx`
Dialog form for creating/editing a property with all the fields (name, email, address, city, country, timezone, currency, check-in/out times, coordinates, etc.).

### `src/components/settings/ManagePropertyUsersDialog.tsx`
Dialog showing users with access to a property, their roles, ability to add/remove users, and change roles. Includes a role permissions matrix tooltip.

### `src/components/settings/DeletePropertyDialog.tsx`
Confirmation dialog requiring the user to type the property name to confirm deletion.

---

## Files to Modify

### `src/pages/Settings.tsx`
Transform from empty placeholder to a tabbed page with a "Properties" tab containing `PropertyList`.

### `src/App.tsx`
Wrap the app (inside `AuthProvider`) with `PropertyProvider`.

### `src/components/SlideMenu.tsx`
Add `PropertySwitcher` component in the header area above the menu sections.

### `src/lib/auth.tsx`
Add `isSystemAdmin` boolean to auth context (fetched from `profiles.is_system_admin`).

---

## What This Plan Does NOT Cover (Phase 2)

- Adding `property_id` foreign key to `units`, `reservations`, `rate_plans`, etc.
- Filtering existing pages by active property
- Updating Channex sync functions to be multi-property aware
- Migrating `channex_property_config` data into the new `properties` table entirely

Phase 1 establishes the foundation. Phase 2 wires existing entities to properties.

---

## Technical Notes

- Foreign keys reference `public.profiles(id)` instead of `auth.users(id)` as required
- The `user_property_access.role` is a TEXT column (not enum) with values: 'owner', 'admin', 'manager', 'staff', 'viewer'
- RLS uses security definer functions to check property access, preventing recursion
- The `is_system_admin` flag on profiles is the escape hatch for users who need access to everything regardless of property assignments
- localStorage key `activePropertyId` persists the selected property across sessions

