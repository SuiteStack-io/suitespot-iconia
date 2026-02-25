

# Customer Excellence — WhatsApp Messaging System

## Overview

Add a full WhatsApp messaging feature to the PMS: two new admin pages (Message Templates + Message Log), a shared edge function for sending via Twilio, automated triggers at check-in form submission, mid-stay (day 3), and checkout, plus two new database tables.

---

## Database Changes

### Table 1: `whatsapp_message_templates`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| template_name | text | e.g. "Welcome Message" |
| template_type | text | "welcome", "midstay", "checkout" |
| message_body | text | With placeholders like `{{guest_name}}` |
| is_enabled | boolean | Default true |
| twilio_content_sid | text, nullable | Links to Twilio template SID |
| created_at | timestamptz | now() |
| updated_at | timestamptz | now() |

RLS: Admin full access. Authenticated SELECT for reading templates in edge functions.

### Table 2: `whatsapp_message_log`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| reservation_id | uuid | References reservations |
| guest_name | text | |
| phone_number | text | Full international format |
| message_type | text | "welcome", "midstay", "checkout" |
| message_body | text | Rendered message |
| status | text | "sent", "delivered", "failed", "skipped" |
| error_message | text, nullable | |
| twilio_message_sid | text, nullable | |
| sent_at | timestamptz | now() |
| created_at | timestamptz | now() |

RLS: Admin full access. System INSERT (for edge functions). Enable realtime for live log updates.

---

## Sidebar Change

**File: `src/components/SlideMenu.tsx`**

Add a new section "CUSTOMER EXCELLENCE" between FRONT DESK and PMS, visible to admins only:
- "Message Templates" → `/message-templates` (icon: `MessageSquareText`)
- "Message Log" → `/message-log` (icon: `ScrollText`)

---

## New Pages

### Page 1: Message Templates (`src/pages/MessageTemplates.tsx`)

- Route: `/message-templates` (protected, admin only)
- Shows 3 template cards (Welcome, Mid-Stay, Checkout)
- Each card has: name, type badge, message body textarea, enable/disable toggle, save button
- Clickable placeholder tags (`{{guest_name}}`, `{{room_name}}`, `{{checkin_date}}`, `{{checkout_date}}`, `{{property_name}}`) that insert into the textarea at cursor position
- Live preview panel with sample data filled in
- On first load, if no templates exist in DB, auto-seed the 3 default templates
- Also shows the linked Twilio Content SID (read-only display from the secret mapping)

### Page 2: Message Log (`src/pages/MessageLog.tsx`)

- Route: `/message-log` (protected, admin only)
- Table showing all sent messages: date/time, guest name, masked phone, message type, booking reference, status, error reason
- Phone masking: `+20 10** *** *89` format
- Filters: message type dropdown, date range picker, status dropdown
- "Resend" button on failed messages — calls the edge function again

---

## Edge Function: `send-whatsapp-message`

**File: `supabase/functions/send-whatsapp-message/index.ts`**

Single function handling all 3 message types. Input:

```json
{
  "reservationId": "uuid",
  "messageType": "welcome" | "midstay" | "checkout"
}
```

Logic:
1. Fetch reservation + unit details + check_in_agreement (for phone number)
2. Fetch the template from `whatsapp_message_templates` by type
3. If template is disabled → log as "skipped" and return
4. If no phone number → log as "skipped — no phone number" and return
5. Check `whatsapp_message_log` for duplicate (same reservation + type) → skip if exists
6. Rate limit check: no message to same phone in last hour
7. Validate phone format (starts with +, >= 10 digits)
8. Format phone as `whatsapp:+XXXXXXXXXXX`
9. Resolve placeholders in message body
10. Call Twilio API: `POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json`
    - Basic Auth: `TWILIO_ACCOUNT_SID:TWILIO_AUTH_TOKEN`
    - Body: `From`, `To`, `ContentSid` (from template's twilio_content_sid or the matching secret), `ContentVariables`
11. Log result to `whatsapp_message_log`
12. Return success/failure

Reads secrets via `Deno.env.get()`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `TWILIO_WELCOME_TEMPLATE_SID`, `TWILIO_MIDSTAY_TEMPLATE_SID`, `TWILIO_CHECKOUT_TEMPLATE_SID`.

Config.toml: `verify_jwt = false` (validated in code).

---

## Trigger Integrations

### Trigger 1: Welcome (on guest form submission)

**File: `src/pages/GuestCheckIn.tsx`** — After the check-in agreement is saved and status updated (around line 310), invoke the edge function:

```typescript
supabase.functions.invoke('send-whatsapp-message', {
  body: { reservationId, messageType: 'welcome' }
});
```

Fire-and-forget (don't block the check-in flow).

### Trigger 2: Mid-Stay (cron job)

**File: `supabase/functions/send-whatsapp-midstay-cron/index.ts`**

New edge function called by a cron job daily at 10:00 AM Cairo time (08:00 UTC):
- Query all `checked-in` reservations where `check_in_date + 2 = today` AND `nights >= 3`
- For each, call the `send-whatsapp-message` function logic (inline, not HTTP call)
- The duplicate check in the log table prevents re-sends

Set up cron via SQL insert (not migration):
```sql
SELECT cron.schedule('whatsapp-midstay-daily', '0 8 * * *', $$
  SELECT net.http_post(
    url:='https://phvduifvymozqiqwvajj.supabase.co/functions/v1/send-whatsapp-midstay-cron',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <anon_key>"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
$$);
```

### Trigger 3: Checkout (on status change)

**File: `src/pages/CheckInOut.tsx`** — After the checkout status update succeeds, invoke:

```typescript
supabase.functions.invoke('send-whatsapp-message', {
  body: { reservationId: reservation.id, messageType: 'checkout' }
});
```

Also add this call in the `CheckOutDialog.tsx` component if checkout happens there.

---

## Routing

**File: `src/App.tsx`** — Add two new protected routes:

```tsx
<Route path="/message-templates" element={<ProtectedRoute><AdminRoute><MessageTemplates /></AdminRoute></ProtectedRoute>} />
<Route path="/message-log" element={<ProtectedRoute><AdminRoute><MessageLog /></AdminRoute></ProtectedRoute>} />
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/MessageTemplates.tsx` | Template management page |
| `src/pages/MessageLog.tsx` | Message log page |
| `supabase/functions/send-whatsapp-message/index.ts` | Core Twilio WhatsApp sender |
| `supabase/functions/send-whatsapp-midstay-cron/index.ts` | Daily mid-stay cron handler |

## Files to Edit

| File | Change |
|------|--------|
| `src/components/SlideMenu.tsx` | Add CUSTOMER EXCELLENCE section |
| `src/App.tsx` | Add routes |
| `src/pages/GuestCheckIn.tsx` | Trigger welcome message after form submission |
| `src/pages/CheckInOut.tsx` | Trigger checkout message after checkout |
| `src/components/CheckOutDialog.tsx` | Trigger checkout message if checkout happens here |

## Database Migration

- Create `whatsapp_message_templates` table with RLS
- Create `whatsapp_message_log` table with RLS
- Enable realtime on `whatsapp_message_log`
- Seed 3 default templates

## Cron Setup (SQL Insert, not migration)

- Schedule `send-whatsapp-midstay-cron` at 08:00 UTC daily
- Enable `pg_cron` and `pg_net` extensions if not already enabled

