

## Apply Three Permission Fixes from Audit

### 1. Database Migration
Add `can_override_rates` boolean column to `user_permissions` table:
```sql
ALTER TABLE user_permissions ADD COLUMN can_override_rates boolean NOT NULL DEFAULT false;
```

### 2. Update `src/lib/auth.tsx`
- Add `can_override_rates: boolean` to the `UserPermissions` interface and `DEFAULT_PERMISSIONS`
- Add it to `fetchUserPermissions` mapping

### 3. Update `src/components/EditPermissionsDialog.tsx`
- Add `can_override_rates` to the local `UserPermissions` interface, default state, `PERMISSION_LABELS`, fetch/save logic, and toggle-all logic
- Label: "Override Room Rates", Description: "Ability to set prices below the standard room rate"

### 4. Update `src/components/CreateReservationDialog.tsx`
- **Line 1023**: Replace `if (!userRole || (userRole !== 'admin' && userRole !== 'manager'))` with `if (!canCreateBooking)`
- **Line 723**: Replace `if (userRole === 'admin') return true` with `if (hasPermission('can_override_rates')) return true`
- **Line 1464**: Replace `userRole === 'admin'` with `hasPermission('can_override_rates')`
- **Line 1466**: Replace `userRole !== 'admin'` with `!hasPermission('can_override_rates')`
- **Line 1478**: Replace `userRole !== 'admin'` with `!hasPermission('can_override_rates')`

### 5. Update `src/pages/ReservationDetail.tsx`
- **Line 160**: Destructure `hasPermission` from `useAuth()`: `const { userRole, hasPermission } = useAuth()`
- **Line 224**: Replace `const canEdit = userRole === 'admin'` with `const canEdit = hasPermission('can_create_booking')`

### Files Modified
- Database migration (new column)
- `src/lib/auth.tsx`
- `src/components/EditPermissionsDialog.tsx`
- `src/components/CreateReservationDialog.tsx`
- `src/pages/ReservationDetail.tsx`

### Not Changed
All "OK TO KEEP" checks (AdminRoute, Users, Commissions, Analytics, Rooms, edge functions) remain untouched.

