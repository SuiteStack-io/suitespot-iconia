

## Add "Access Front Desk" Permission

Add a new granular permission `can_access_front_desk` that controls access to the Front Desk section pages: Room Rates, Guests, and Guest Forms.

### 1. Database Migration

Add a new column to the `user_permissions` table:

```sql
ALTER TABLE public.user_permissions
ADD COLUMN can_access_front_desk boolean NOT NULL DEFAULT false;
```

### 2. Auth Context (`src/lib/auth.tsx`)

- Add `can_access_front_desk` to the `UserPermissions` interface and `DEFAULT_PERMISSIONS`
- Include it in `fetchUserPermissions` mapping

### 3. Permissions Dialog (`src/components/EditPermissionsDialog.tsx`)

- Add `can_access_front_desk` to the `UserPermissions` interface
- Add label entry: **"Access Front Desk"** with description **"Access to Room Rates, Guests, and Guest Forms pages"**
- Include it in `PERMISSION_LABELS`, default state, fetch mapping, toggle-all, and save logic

### 4. Route Protection

Wrap the three Front Desk routes in `src/App.tsx` with permission checks (or add guards inside each page component) so that users without `can_access_front_desk` (and who are not admins) get redirected.

**Pages affected:**
- `/front-desk/room-rates` -- `src/pages/front-desk/RoomRates.tsx`
- `/guests` -- `src/pages/Guests.tsx`
- `/guest-forms` -- `src/pages/GuestForms.tsx`

Each page will check `hasPermission('can_access_front_desk')` early and redirect to `/admin` if denied.

### 5. Sidebar Visibility (`src/components/SlideMenu.tsx`)

Add `can_access_front_desk` permission check to the FRONT DESK section items so they are hidden from users who lack the permission. Admins always see everything.

### Summary of Files Changed

| File | Change |
|------|--------|
| Database migration | Add `can_access_front_desk` column |
| `src/lib/auth.tsx` | Add to interface + defaults + fetch |
| `src/components/EditPermissionsDialog.tsx` | Add to interface, labels, state, save |
| `src/components/SlideMenu.tsx` | Conditionally show Front Desk items |
| `src/pages/Guests.tsx` | Permission guard |
| `src/pages/GuestForms.tsx` | Permission guard |
| `src/pages/front-desk/RoomRates.tsx` | Permission guard |

