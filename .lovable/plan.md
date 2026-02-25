

## WhatsApp Guest Messaging via Twilio

### Overview
Implement automated WhatsApp messaging triggered at three points in the guest journey: check-in (welcome), day 3 of stay (mid-stay), and checkout. A single `send-whatsapp` edge function handles all Twilio API calls. A read-only Message Log page is added under a new "CUSTOMER EXCELLENCE" sidebar section.

### What Already Exists
- `whatsapp_message_log` table already exists with columns: id, reservation_id, guest_name, phone_number, message_type, status, error_message, twilio_message_sid, sent_at, message_body. RLS policies in place (admin ALL, system INSERT).
- `whatsapp_message_templates` table exists but is NOT needed (templates live in Twilio, PMS only triggers).
- `check_in_agreements` table stores `guest_phone` (with country code already concatenated, e.g. `+201234567890`).
- Check-in/checkout status changes are triggered from frontend code in `Dashboard.tsx`, `CheckInOut.tsx`, `ReservationQuickActions.tsx`, and `GuestCheckIn.tsx` — all already call edge functions like `send-checkin-notification`.
- All six Twilio secrets are already configured.
- A mid-stay cleaning cron job already exists (for email notifications).

### Implementation Plan

#### 1. Edge Function: `send-whatsapp`
**New file:** `supabase/functions/send-whatsapp/index.ts`

- Accepts POST with: `phone_number`, `template_sid`, `guest_name`, `booking_id`, `message_type`
- Reads `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` from `Deno.env.get()`
- **Duplicate check**: Queries `whatsapp_message_log` for existing `reservation_id` + `message_type` with status `sent` — if found, returns early
- **Phone validation**: Strips spaces/dashes/parens. If doesn't start with `+`, logs as "skipped" and returns
- Calls Twilio Messages API with form-urlencoded body: `From`, `To` (whatsapp:+...), `ContentSid`, `ContentVariables` (JSON `{"1": guest_name}`)
- Logs result to `whatsapp_message_log` (sent/failed/skipped with error_message and twilio_message_sid)
- Uses service role key to bypass RLS for DB operations
- CORS headers included; `verify_jwt = false` in config.toml

**Config addition:** `supabase/config.toml` — add `[functions.send-whatsapp]` with `verify_jwt = false`

#### 2. Trigger 1: Welcome Message (on check-in)
**Modified files:** `src/components/Dashboard.tsx`, `src/pages/CheckInOut.tsx`, `src/components/ReservationQuickActions.tsx`, `src/pages/GuestCheckIn.tsx`

At every location where `send-checkin-notification` is called, add an additional call:
```typescript
supabase.functions.invoke('send-whatsapp', {
  body: {
    phone_number: guestPhone,   // from check_in_agreements
    template_sid: 'WELCOME',    // edge function maps to env var
    guest_name: guestName,
    booking_id: reservationId,
    message_type: 'welcome'
  }
});
```

The edge function will look up the phone from `check_in_agreements` by reservation_id if not provided directly. This avoids needing the phone on the frontend. Alternative: the edge function accepts `booking_id` and fetches the phone itself (cleaner approach — only `booking_id` and `message_type` needed from frontend, edge function resolves everything else).

**Chosen approach:** The `send-whatsapp` function will accept `booking_id` and `message_type` as minimum required params. It will:
1. Look up reservation to get `guest_names[0]`
2. Look up `check_in_agreements` to get `guest_phone`
3. Map `message_type` to the correct template SID env var
4. Handle all validation and duplicate checks internally

This simplifies all frontend call sites to just:
```typescript
supabase.functions.invoke('send-whatsapp', {
  body: { booking_id: reservationId, message_type: 'welcome' }
});
```

#### 3. Trigger 2: Mid-Stay Message (day 3, 10 AM Cairo)
**New file:** `supabase/functions/send-whatsapp-midstay/index.ts`

A cron-triggered edge function that:
1. Queries reservations where `status = 'checked-in'` and `check_in_date + 2 days = today` and `nights >= 3`
2. For each, checks `whatsapp_message_log` for existing `midstay` entry — skips if found
3. Looks up phone from `check_in_agreements`
4. Calls `send-whatsapp` (or does the Twilio call inline to avoid function-to-function calls — inline is more reliable)
5. Actually, to keep it DRY: this function will contain the Twilio sending logic directly (same as send-whatsapp) since edge-function-to-edge-function calls add latency and failure points

**Cron job** (via SQL insert tool, not migration):
```sql
SELECT cron.schedule(
  'send-whatsapp-midstay',
  '0 8 * * *',  -- 08:00 UTC = 10:00 AM Cairo
  $$ SELECT net.http_post(
    url:='https://phvduifvymozqiqwvajj.supabase.co/functions/v1/send-whatsapp-midstay',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'::jsonb,
    body:='{}'::jsonb
  ) $$
);
```

**Config addition:** `[functions.send-whatsapp-midstay]` with `verify_jwt = false`

#### 4. Trigger 3: Checkout Message (on checkout)
Same pattern as welcome. At every location where `send-checkout-notification` is called, add:
```typescript
supabase.functions.invoke('send-whatsapp', {
  body: { booking_id: reservationId, message_type: 'checkout' }
});
```

#### 5. Message Log Page
**New file:** `src/pages/MessageLog.tsx`

- Fetches from `whatsapp_message_log` joined with `reservations` (for booking_reference)
- Columns: Date, Guest Name, Phone (masked: `****1234`), Type (badge), Booking Ref, Status (colored badge: green=sent, red=failed, gray=skipped)
- Filters: message_type dropdown, status dropdown, date range picker
- Sorted by `sent_at` DESC
- Read-only, no edit/delete
- Standard admin page layout with breadcrumb

**Route addition in `App.tsx`:**
```typescript
<Route path="/message-log" element={<ProtectedRoute><AdminRoute><MessageLog /></AdminRoute></ProtectedRoute>} />
```

#### 6. Sidebar: CUSTOMER EXCELLENCE Section
**Modified file:** `src/components/SlideMenu.tsx`

Insert new section between FRONT DESK and PMS:
```typescript
{
  label: 'CUSTOMER EXCELLENCE',
  items: [
    { title: 'Message Log', url: '/message-log', icon: MessageSquare },
  ],
  showFor: ['admin'],
}
```

### Database Changes
No new tables needed — `whatsapp_message_log` already exists with the required schema. Need to enable `pg_cron` and `pg_net` extensions for the mid-stay cron job (may already be enabled from existing cron jobs).

### Files to Create
| File | Purpose |
|------|---------|
| `supabase/functions/send-whatsapp/index.ts` | Main WhatsApp sending function |
| `supabase/functions/send-whatsapp-midstay/index.ts` | Cron-triggered mid-stay checker |
| `src/pages/MessageLog.tsx` | Admin message log page |

### Files to Modify
| File | Change |
|------|--------|
| `src/components/SlideMenu.tsx` | Add CUSTOMER EXCELLENCE section |
| `src/App.tsx` | Add `/message-log` route |
| `src/components/Dashboard.tsx` | Add WhatsApp call on check-in/checkout |
| `src/pages/CheckInOut.tsx` | Add WhatsApp call on check-in/checkout |
| `src/components/ReservationQuickActions.tsx` | Add WhatsApp call on check-in/checkout |
| `src/pages/GuestCheckIn.tsx` | Add WhatsApp call on check-in |

### Safeguards Summary
- Duplicate prevention via `whatsapp_message_log` check (booking_id + message_type + status='sent')
- Phone validation (must start with `+`, stripped of formatting)
- No auto-retry on failure
- Independent message types (failure of one doesn't block others)
- All credentials from `Deno.env.get()`, never hardcoded

