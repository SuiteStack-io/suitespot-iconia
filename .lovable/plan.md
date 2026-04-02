

## Add Email Notification for New Guest Messages

### What this does
After the `channex-message-webhook` stores an incoming guest message, it will send an email notification to property operators via the existing `send-admin-notification` pattern (Resend + property-scoped user filtering).

### Changes

#### 1. New Edge Function: `supabase/functions/send-message-notification/index.ts`
A lightweight notification function that:
- Accepts: `property_id`, `guest_name`, `provider` (OTA source), `message_text`, `booking_reference`, `thread_id`
- Fetches admin/front_desk users with property access (same pattern as `send-reservation-notification`)
- Filters by notification preferences (can reuse existing `new_booking_email` pref or add a new one later)
- Sends email via Resend with subject: `"New Message from [Guest Name] - [Property Name]"`
- Email body includes: guest name, OTA source, booking reference (if available), message text, "Reply from your PMS Inbox" note
- Rate-limits with 600ms delay between recipients (existing pattern)

#### 2. Update: `supabase/functions/channex-message-webhook/index.ts`
After successfully storing the message (line ~185 and ~98), add a notification block:
- **Only for incoming messages**: Check `sender !== 'property'` and `sender !== 'operator'` (only notify for guest messages)
- **Throttle**: Check the thread's `last_message_at` — if last notification was sent <5 minutes ago for the same thread, skip the email. Use a simple query: check `message_threads.last_notification_sent_at` field
- Fetch thread details (title, provider, reservation info) to populate the email
- Call `send-message-notification` via `fetch()` with service role auth (same pattern as booking webhook notifications)
- Wrap in try/catch so notification failure never blocks the webhook ACK

#### 3. Database Migration
Add `last_notification_sent_at` (timestamptz, nullable) column to `message_threads` table for throttling. Updated by the webhook after sending a notification.

#### 4. Config: `supabase/config.toml`
Add `[functions.send-message-notification]` with `verify_jwt = false`

### Email template style
Matches existing notification emails (dark navy header, structured detail rows, Resend via `notifications@bookings.suitespoteg.com`).

### Throttle logic
```text
For each incoming guest message:
  if sender is 'property' or 'operator' → skip notification
  if thread.last_notification_sent_at > (now - 5 minutes) → skip notification
  else → send email, update last_notification_sent_at
```

### Summary
- 1 new edge function (`send-message-notification`)
- 1 file edited (`channex-message-webhook`)
- 1 migration (add throttle column)
- 1 config entry

