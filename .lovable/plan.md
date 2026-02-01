

## Plan: User Permissions System

### Summary

Add a granular permissions system that allows admins to configure specific capabilities for each user. This will replace hardcoded role-based access with fine-grained permission controls, enabling front desk users to operate fully without admin access.

---

### Permissions to Implement

| Permission | Description |
|------------|-------------|
| `can_check_in` | Ability to check in guests |
| `can_check_out` | Ability to check out guests |
| `can_submit_forms` | Ability to complete and submit guest forms |
| `can_create_booking` | Ability to create a manual booking |
| `can_change_rooms` | Ability to change rooms for an existing booking |
| `can_block_dates` | Ability to block dates on the calendar |
| `can_export_calendar` | Ability to export the calendar |

---

### Technical Changes

#### 1. Database: New `user_permissions` Table

```sql
CREATE TABLE user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_check_in boolean DEFAULT false,
  can_check_out boolean DEFAULT false,
  can_submit_forms boolean DEFAULT false,
  can_create_booking boolean DEFAULT false,
  can_change_rooms boolean DEFAULT false,
  can_block_dates boolean DEFAULT false,
  can_export_calendar boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS policies for user_permissions
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can manage all permissions
CREATE POLICY "Admins can manage user permissions"
ON user_permissions FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own permissions
CREATE POLICY "Users can view own permissions"
ON user_permissions FOR SELECT TO authenticated
USING (user_id = auth.uid());
```

#### 2. Database Function: Check User Permission

```sql
CREATE OR REPLACE FUNCTION has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_result boolean;
BEGIN
  -- Admins always have all permissions
  IF has_role(_user_id, 'admin'::app_role) THEN
    RETURN true;
  END IF;
  
  -- Check specific permission
  EXECUTE format(
    'SELECT %I FROM user_permissions WHERE user_id = $1',
    _permission
  ) INTO v_result USING _user_id;
  
  RETURN COALESCE(v_result, false);
END;
$$;
```

#### 3. Update RLS Policies

Update the reservations UPDATE policy to check `can_check_in` or `can_check_out` permissions:

```sql
DROP POLICY IF EXISTS "Admins, managers, and front desk can update reservations" ON reservations;

CREATE POLICY "Users with permissions can update reservations"
ON reservations FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_permission(auth.uid(), 'can_check_in') OR
  has_permission(auth.uid(), 'can_check_out')
);
```

Update blocked_dates policies:

```sql
-- Replace INSERT policy
DROP POLICY IF EXISTS "Admins can insert blocked dates" ON blocked_dates;
CREATE POLICY "Users with permission can insert blocked dates"
ON blocked_dates FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_permission(auth.uid(), 'can_block_dates')
);

-- Replace DELETE policy
DROP POLICY IF EXISTS "Admins can delete blocked dates" ON blocked_dates;
CREATE POLICY "Users with permission can delete blocked dates"
ON blocked_dates FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_permission(auth.uid(), 'can_block_dates')
);
```

---

#### 4. Frontend: Auth Context Enhancement

Update `src/lib/auth.tsx` to include user permissions:

```typescript
interface UserPermissions {
  can_check_in: boolean;
  can_check_out: boolean;
  can_submit_forms: boolean;
  can_create_booking: boolean;
  can_change_rooms: boolean;
  can_block_dates: boolean;
  can_export_calendar: boolean;
}

interface AuthContextType {
  // ... existing fields
  permissions: UserPermissions | null;
  hasPermission: (permission: keyof UserPermissions) => boolean;
}
```

The `hasPermission` function will:
- Return `true` for all permissions if user is admin
- Check the specific permission from `user_permissions` table otherwise

---

#### 5. Frontend: Edit Permissions Modal Component

Create `src/components/EditPermissionsDialog.tsx`:

- Modal with user name at top
- List of 7 permissions with Switch/Toggle for each
- Save button to persist changes immediately
- Shows current state on open

---

#### 6. Update Users.tsx Page

Add "Edit Permissions" button next to each user:

```text
| Name        | Email              | Role       | Actions              |
|-------------|--------------------| -----------|----------------------|
| Dina Mamdouh| dina@example.com   | front_desk | [Edit] [Permissions] |
```

The Permissions button opens the EditPermissionsDialog.

---

#### 7. Enforce Permissions in UI Components

| Component | Permission Check |
|-----------|------------------|
| `CheckInOut.tsx` | Hide check-in button if `!hasPermission('can_check_in')` |
| `CheckInOut.tsx` | Hide check-out button if `!hasPermission('can_check_out')` |
| `CreateReservationDialog.tsx` | Hide dialog trigger if `!hasPermission('can_create_booking')` |
| `RoomSwapDialog.tsx` | Disable if `!hasPermission('can_change_rooms')` |
| `RoomTransferDialog.tsx` | Disable if `!hasPermission('can_change_rooms')` |
| `BlockedDatesManager.tsx` | Hide add/delete buttons if `!hasPermission('can_block_dates')` |
| `AvailabilityCalendar.tsx` | Hide export buttons if `!hasPermission('can_export_calendar')` |
| `GuestForms.tsx` | Hide submit buttons if `!hasPermission('can_submit_forms')` |

---

### Auto-Grant Permissions for Admins

Admins automatically have all permissions through the `has_permission()` function - no need to store explicit records.

---

### Files to Create/Modify

| File | Change |
|------|--------|
| **Database migration** | Create `user_permissions` table, RLS policies, and helper function |
| `src/lib/auth.tsx` | Add permissions state and `hasPermission()` helper |
| `src/components/EditPermissionsDialog.tsx` | **New** - Modal to edit user permissions |
| `src/pages/Users.tsx` | Add "Edit Permissions" button for each user |
| `src/pages/CheckInOut.tsx` | Check permissions before showing check-in/out buttons |
| `src/components/CreateReservationDialog.tsx` | Check `can_create_booking` permission |
| `src/components/RoomSwapDialog.tsx` | Check `can_change_rooms` permission |
| `src/components/RoomTransferDialog.tsx` | Check `can_change_rooms` permission |
| `src/components/BlockedDatesManager.tsx` | Check `can_block_dates` permission |
| `src/components/AvailabilityCalendar.tsx` | Check `can_export_calendar` permission |
| `src/pages/GuestForms.tsx` | Check `can_submit_forms` permission |

---

### Example: EditPermissionsDialog UI

```text
┌────────────────────────────────────────────┐
│  Edit Permissions                      [X] │
│  Dina Mamdouh (front_desk)                 │
├────────────────────────────────────────────┤
│                                            │
│  Check In Guests              [====ON====] │
│  Check Out Guests             [====ON====] │
│  Complete Guest Forms         [====ON====] │
│  Create Manual Booking        [===OFF====] │
│  Change Rooms                 [===OFF====] │
│  Block Calendar Dates         [===OFF====] │
│  Export Calendar              [====ON====] │
│                                            │
├────────────────────────────────────────────┤
│                        [Cancel] [  Save  ] │
└────────────────────────────────────────────┘
```

---

### Verification

After implementation:
1. Admin can open User Management and see "Edit Permissions" button
2. Clicking it opens a modal with toggles for each permission
3. Saving updates the database immediately
4. Front desk user with `can_check_in` enabled can check in guests
5. Front desk user without `can_check_in` won't see check-in buttons
6. All permission checks work both in UI and via RLS at database level

