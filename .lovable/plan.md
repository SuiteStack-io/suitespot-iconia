

## Add 3 Granular Permissions: Delete Reservations, View Revenue, Manage Rooms

### 1. Database — extend `user_permissions`
New migration adds three boolean columns (default `false`, NOT NULL):
- `can_delete_reservation`
- `can_view_revenue`
- `can_manage_rooms`

The existing `has_permission(_user_id, _permission)` SQL function uses dynamic `EXECUTE format(...)`, so it picks up new columns automatically — no function update needed.

### 2. Auth context — `src/lib/auth.tsx`
Extend `UserPermissions` interface, `DEFAULT_PERMISSIONS`, and `fetchUserPermissions` with the three new keys (mirroring existing pattern). The admin shortcut `if (userRole === 'admin') return true` already grants admins everything.

### 3. Edit Permissions dialog — `src/components/EditPermissionsDialog.tsx`
- Add the three keys to local `UserPermissions` type, initial state, `fetchPermissions` mapping, and `handleToggleAll`.
- Add three entries to `PERMISSION_LABELS`:
  - `can_delete_reservation` → "Delete Reservations" / "Ability to permanently delete reservations"
  - `can_view_revenue` → "View Revenue Data" / "Access to revenue metrics like RevPAR and net revenue"
  - `can_manage_rooms` → "Manage Rooms" / "Ability to manage room types, units, and room settings"

These render automatically in the existing two-column grid.

### 4. Replace hardcoded admin checks

| File | Line | Change |
|------|------|--------|
| `src/components/ReservationsList.tsx` | 1121 | Import `useAuth`, derive `const { hasPermission } = useAuth()`; replace `userRole === 'admin'` (Permanently Delete button) with `hasPermission('can_delete_reservation')`. The `userRole` prop stays for now (used elsewhere). |
| `src/components/AvailabilityCalendar.tsx` | 1927 | Replace `userRole === 'admin'` (RevPAR card) with `hasPermission('can_view_revenue')`. Add `hasPermission` to the existing `useAuth()` destructure on line 275. |
| `src/pages/Rooms.tsx` | 218 | Replace access-gate `userRole !== 'admin'` with `!hasPermission('can_manage_rooms')`; pull `hasPermission` from `useAuth()`. |
| `src/pages/Rooms.tsx` | 1132 | Replace `const isAdmin = userRole === 'admin'` with `const canManageRooms = hasPermission('can_manage_rooms')`; rename all 6 downstream `isAdmin` usages (lines 1173, 1353, 1451, 1503, 1524, plus the table cell) to `canManageRooms`. |
| `src/pages/ReservationsListPage.tsx` | 28 | Replace `const isAdmin = userRole === 'admin'` with `const canDelete = hasPermission('can_delete_reservation')`; pull `hasPermission` from `useAuth()`. (Note: `isAdmin` is currently unused in JSX of this file — the rename keeps the variable defined but it remains unused unless a future destructive control wires to it. Removing it entirely is fine since it's unused — the simpler change is to delete the line.) **Final action:** delete the unused `isAdmin` line entirely (no destructive actions render in this page; deletion is handled inside `ReservationsList`).

### 5. Out of scope (unchanged per instructions)
- `AdminRoute.tsx`, `Users.tsx`, `Commissions.tsx`, `Analytics.tsx` access gates.
- Core permission resolution in `lib/auth.tsx` (`hasPermission` shortcut for admin).
- Edge functions.

### Verification
1. Apply migration → three new columns exist on `user_permissions` with default `false`.
2. Open Edit Permissions for a non-admin user → three new toggles appear in the Permissions grid; "Select All" toggles them too; saving persists values.
3. Non-admin without `can_delete_reservation` → "Permanently Delete" button hidden in ReservationsList bulk actions toolbar.
4. Non-admin without `can_view_revenue` → RevPAR card hidden on the Unit Availability Calendar.
5. Non-admin without `can_manage_rooms` → redirected from `/rooms` with the existing toast; admin-only edit/clone/delete UI hidden.
6. Admin user → all destructive/reveal UI continues to render automatically (auth shortcut grants every permission).

