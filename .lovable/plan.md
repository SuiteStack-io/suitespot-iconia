

## Create `channex-send-message` Edge Function

### File: `supabase/functions/channex-send-message/index.ts`

New edge function called from PMS UI to send operator replies via Channex API.

**Flow:**
1. Accept `POST { booking_id, message }` — validate both required
2. Call Channex: `POST /api/v1/bookings/{booking_id}/messages` with `{ message: { message: text } }` via `channexRequest`
3. Extract from response: `data.id` (message ID), `data.attributes.inserted_at`, `data.relationships.message_thread.data.id` (thread ID)
4. Look up local thread by `channex_thread_id` — if found, insert message row and update thread denormalized fields (`last_message_text`, `last_message_sender = "property"`, `last_message_at`, `message_count + 1`, `is_read = true` since operator just sent it)
5. If thread not found, create it (fetch thread details from Channex API, same pattern as webhook)
6. Log via `logSync`, return `{ success: true, message_id }`

**Error handling:**
- 422 → `"This OTA does not support messaging"`
- 403 → `"Messages app not installed for this property"`
- Other errors → generic `{ success: false, error }`
- Use `ChannexApiError` statusCode for detection

**Config:** Add to `supabase/config.toml`:
```toml
[functions.channex-send-message]
verify_jwt = false
```

### Files
- **Create:** `supabase/functions/channex-send-message/index.ts`
- **Update:** `supabase/config.toml` (add function entry)

