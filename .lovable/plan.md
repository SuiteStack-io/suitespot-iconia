

## Create Guest Messaging Inbox Tables

### Migration

Single migration creating two tables, indexes, and RLS policies.

**Tables:**
1. `message_threads` — one row per Channex conversation thread, with denormalized last-message preview fields
2. `messages` — individual messages within a thread

**Key decisions:**
- `channex_booking_id` is `text` (not FK) to match the existing pattern in `channex_bookings` table
- `property_id` references `properties(id)`, `reservation_id` references `reservations(id)` — both nullable
- RLS: authenticated users get full CRUD access (tenant scoping deferred)
- Enable realtime on `message_threads` for live inbox updates
- Add `updated_at` trigger on `message_threads` using existing `update_updated_at_column()` function

**Indexes:**
- `message_threads`: property_id, channex_booking_id, is_read, last_message_at DESC
- `messages`: thread_id + created_at composite

**Files:** One database migration only. No UI or edge function changes.

