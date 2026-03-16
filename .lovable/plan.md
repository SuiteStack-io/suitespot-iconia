

## Create `channex-sync-messages` Edge Function

**Purpose:** On-demand backfill of all Channex message threads and their messages into the local database.

### File: `supabase/functions/channex-sync-messages/index.ts`

**Flow:**
1. Accept POST with optional `{ property_id }` (local ID)
2. Query `channex_mappings` for `entity_type = 'property'` — if `property_id` provided, filter to that one
3. For each property mapping, call `channexRequest("GET", /api/v1/message_threads?filter[property_id]=${channexId}&pagination[limit]=100)`
4. For each thread in response:
   - Skip if `channex_thread_id` already exists in `message_threads`
   - Extract: title, provider, is_closed, booking_id from thread attributes/relationships
   - Resolve `property_id` from the mapping's `local_id`
   - Resolve `reservation_id` by looking up `channex_booking_id` in `reservations`
   - Insert thread record
   - Fetch messages: `GET /api/v1/message_threads/${threadId}/messages?pagination[limit]=100`
   - Insert messages, skipping duplicates by `channex_message_id`
   - 200ms delay between API calls
5. Log via `logSync`, return `{ success, threads_synced, messages_synced }`

**Config:** Add `[functions.channex-sync-messages] verify_jwt = false` to `supabase/config.toml`.

**Patterns:** Reuses `channexRequest` and `logSync` from `_shared/channex-client.ts`, follows the same CORS headers and response helpers as other Channex functions.

