

## Build Conversation/Chat View for Guest Inbox

### Overview
Add a conversation panel to the right side of the inbox that displays messages in chat-bubble style with a reply composer, replacing the current placeholder.

### Changes

**1. Create `src/components/inbox/ConversationPanel.tsx`**

New component receiving `thread: MessageThread` as prop. Three sections:

- **Header bar**: Guest name, OTA colored pill, "View Reservation" link (if `reservation_id`), Open/Closed badge
- **Message area**: `ScrollArea` filling remaining height. Chat bubbles — guest messages left-aligned (gray bg), property messages right-aligned (primary bg, white text). Each bubble: message text, formatted timestamp ("Mar 11, 2:30 PM"), sender label on guest messages ("Guest via Airbnb"). Attachments rendered as clickable links/image thumbnails if present.
- **Reply input**: `Textarea` (max 4 rows) + Send button. Enter sends, Shift+Enter newline. Disabled when `is_closed` or sending. Shows status banner if closed or messaging unsupported.

**Key logic:**
- `useEffect` on `thread.id`: fetch messages from `messages` table where `thread_id = thread.id`, order by `created_at ASC`. Auto-scroll to bottom via `scrollIntoView`.
- Mark thread read: `supabase.from("message_threads").update({ is_read: true }).eq("id", thread.id)` on mount.
- Realtime: subscribe to `postgres_changes` on `messages` table filtered by `thread_id=eq.${thread.id}`. Append new messages and scroll down.
- Send: call `supabase.functions.invoke("channex-send-message", { body: { booking_id: thread.channex_booking_id, message } })`. Optimistic insert with `status: "sending"`, update to `"sent"` on success or `"failed"` on error (with toast + retry).

**2. Update `src/pages/GuestInbox.tsx`**

- Import `ConversationPanel`
- Add `channex_booking_id` to the `MessageThread` interface
- Replace the right-panel placeholder: if `selectedThreadId` exists, find the thread object and render `<ConversationPanel thread={selectedThread} />`, otherwise show existing placeholder
- On mobile: when a thread is selected, show conversation full-width instead of thread list, with a back button to deselect

### No database or edge function changes needed
All tables (`message_threads`, `messages`) and the `channex-send-message` function already exist with the required schema and RLS policies.

