

## Create `channex-message-webhook` Edge Function

### File: `supabase/functions/channex-message-webhook/index.ts`

New edge function following the booking webhook pattern:

1. **CORS + always-200 pattern** — same `corsHeaders`, `ok()` helper, OPTIONS handler
2. **Parse payload** — extract `id`, `message`, `sender`, `property_id`, `booking_id`, `message_thread_id`, `attachments`, `timestamp`
3. **Resolve local property_id** — query `channex_mappings` where `channex_id = payload.property_id` and `entity_type = 'property'`
4. **Idempotency** — check `messages` table for existing `channex_message_id`. If found, return early with success
5. **Thread lookup** — query `message_threads` by `channex_thread_id`:
   - **Exists**: insert message, update thread denormalized fields (`last_message_text`, `last_message_sender`, `last_message_at`, `message_count + 1`, `is_read = false`)
   - **Not found**: fetch `GET /api/v1/message_threads/{id}` from Channex API for title/provider/is_closed, resolve `reservation_id` via `channex_bookings` → `reservations` lookup, create thread row, then insert message
6. **logSync** on success and failure
7. **Return 200** always

### File: `supabase/config.toml`

Add:
```toml
[functions.channex-message-webhook]
verify_jwt = false
```

### Summary
- 1 new file, 1 file updated (config.toml)
- No UI changes
- No database changes (tables already exist)

