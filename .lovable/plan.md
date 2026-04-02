

## Add Unread Guest Message Badge to Nav Bar and Sidebar

### What this does
Adds a chat icon with red unread count badge in two locations: the top navigation bar (next to the bell icon) and the "Guest Inbox" sidebar menu item. Both stay in sync via a shared hook with real-time updates.

### No database changes needed
The `message_threads` table already has an `is_read` boolean column. The GuestInbox page already uses `threads.filter(t => !t.is_read).length` for unread count. We'll use the same thread-level unread tracking.

### Changes

#### 1. New shared hook: `src/hooks/useUnreadMessages.tsx`
- On mount: query `message_threads` where `is_read = false`, filtered by active property
- Subscribe to Supabase Realtime on `message_threads` (INSERT/UPDATE) to update count live
- Returns `{ unreadCount }` — both locations consume this single hook
- Uses property context to scope the count

#### 2. New component: `src/components/UnreadMessagesBadge.tsx`
- MessageCircle icon (from lucide-react) with red badge (same style as NotificationBell: `Badge variant="destructive"` absolutely positioned)
- Clicking navigates to `/admin/inbox`
- Badge hidden when count is 0

#### 3. Update: `src/pages/Index.tsx` (top nav bar)
- Import and add `<UnreadMessagesBadge />` next to `<NotificationBell />` (line ~151)

#### 4. Update: `src/components/SlideMenu.tsx` (sidebar)
- Import `useUnreadMessages` hook
- Next to the "Guest Inbox" menu item, render a small red badge with the count when > 0

### Summary
- 2 new files (hook + component)
- 2 files edited (Index.tsx, SlideMenu.tsx)
- No migrations, no edge functions

