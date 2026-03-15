

## Create Guest Inbox Page at `/admin/inbox`

### Files to create/modify

**1. Create `src/pages/GuestInbox.tsx`** — Main inbox page

Split-panel layout matching existing PMS style (SlideMenu, back button, title pattern from GuestTickets):

- **Header**: SlideMenu + back button + "Guest Inbox" title with `MessageCircle` icon
- **Filter tabs**: All | Unread (with badge) | Airbnb | Booking.com | Expedia — using `Tabs` component
- **Left panel (40% desktop, full mobile)**: Thread list cards sorted by `last_message_at` DESC
  - Each card: OTA colored badge, guest name (bold if unread), message preview (truncated 80 chars, bold if unread), relative time, blue unread dot, optional "View Reservation" link
  - Clicking selects the thread (sets state on desktop, navigates on mobile — mobile conversation view deferred)
- **Right panel (60% desktop, hidden mobile)**: Placeholder "Select a conversation to view messages"

**Data fetching:**
- Query `message_threads` ordered by `last_message_at DESC`
- Client-side filtering by tab (is_read, provider)
- Realtime subscription on `message_threads` channel for `postgres_changes` to auto-refresh

**Relative time helper**: inline function using `Date.now() - lastMessageAt` to produce "2m ago", "1h ago", "Yesterday", or formatted date.

**2. Update `src/App.tsx`**
- Import `GuestInbox` and add route: `/admin/inbox` wrapped in `<ProtectedRoute>`

**3. Update `src/components/SlideMenu.tsx`**
- Add "Guest Inbox" menu item under ICONIA section with `MessageCircle` icon

### No database changes needed
Tables and realtime already configured from previous migrations.

