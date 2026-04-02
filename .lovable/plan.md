

## Add Guest Inbox Permission Control

### What this does
Adds a `can_access_guest_inbox` permission to the existing granular permissions system, controlling visibility of the Guest Inbox menu item, unread badge, nav icon, and page access.

### Changes

#### 1. Database Migration
Add `can_access_guest_inbox` boolean column (default `false`) to `user_permissions` table.

#### 2. Update: `src/lib/auth.tsx`
- Add `can_access_guest_inbox` to the `UserPermissions` interface and `DEFAULT_PERMISSIONS`

#### 3. Update: `src/components/EditPermissionsDialog.tsx`
- Add `can_access_guest_inbox` to the `UserPermissions` interface and `PERMISSION_LABELS` with label "Access Guest Inbox" and description "View and reply to guest messages from OTA channels"

#### 4. Update: `src/components/SlideMenu.tsx`
- Add `showFor` condition on the Guest Inbox menu item: only show when `userRole === 'admin'` or `hasPermission('can_access_guest_inbox')`
- Conditionally render the unread badge based on the same check

#### 5. Update: `src/pages/Index.tsx`
- Wrap `<UnreadMessagesBadge />` with permission check: only render when admin or has `can_access_guest_inbox`

#### 6. Update: `src/pages/GuestInbox.tsx`
- Add permission check on mount — if not admin and no `can_access_guest_inbox`, redirect to `/admin`

#### 7. Update: `src/components/inbox/ConversationPanel.tsx`
- Disable reply input when user lacks permission (defensive check)

### Summary
- 1 migration (add column)
- 6 files edited
- Follows exact same pattern as `can_access_front_desk` and `can_access_pms`
- Admins always have access; other roles need the permission toggled on

