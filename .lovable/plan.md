

## Create Channex Booking Webhook Edge Function

### Overview

Create a new edge function `channex-booking-webhook` that acts as a webhook endpoint for Channex. When bookings happen on OTAs (Booking.com, Expedia, etc.), Channex sends a POST request to this URL with booking details. The function stores the data and acknowledges the booking revision.

This is a **public webhook** -- no user authentication is needed since Channex calls it, not a browser.

---

### Request/Response Flow

```text
Channex POST -> Parse payload -> Resolve local property ID
                                       |
              +------------------------+------------------------+
              |                        |                        |
         status: "new"          status: "modified"       status: "cancelled"
              |                        |                        |
         INSERT into             UPDATE existing           UPDATE status
        channex_bookings       channex_bookings            to "cancelled"
              |                        |                        |
              +------------------------+------------------------+
                                       |
                              ACK booking revision
                              POST /api/v1/booking_revisions/{id}/ack
                                       |
                              Log to channex_sync_logs
                                       |
                              Return 200 OK (always)
```

---

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/channex-booking-webhook/index.ts` | Create new edge function |
| `supabase/config.toml` | Add `[functions.channex-booking-webhook]` with `verify_jwt = false` |

---

### Technical Details

#### No Authentication Required

Unlike other Channex functions, this is a webhook called by Channex's servers, not by authenticated users. The function uses the service role key directly to write to the database.

#### Payload Parsing

Extract fields from the Channex webhook payload:

```typescript
const { event, property_id: channexPropertyId, payload } = body;
const {
  id: revisionId,        // channex_revision_id
  booking_id,            // channex_booking_id
  status,                // "new", "modified", or "cancelled"
  ota_name,
  ota_reservation_code,
  arrival_date,
  departure_date,
  customer,              // { name, surname, mail, phone }
  rooms,                 // array of room details
  amount,                // total as string like "450.00"
  currency,
} = payload;
```

#### Guest Name Construction

Combine customer name and surname:

```typescript
const guestName = [customer?.name, customer?.surname].filter(Boolean).join(' ') || 'Unknown Guest';
```

#### Room/Rate Resolution (Best Effort)

Attempt to resolve `room_type_id` and `rate_plan_id` from `channex_mappings` using the Channex IDs in the `rooms` array. These are nullable columns, so it's fine if they can't be resolved.

#### Status Handling

| Status | Action |
|--------|--------|
| `new` | INSERT new record into `channex_bookings` |
| `modified` | UPSERT -- find by `channex_booking_id` and update all fields |
| `cancelled` | UPDATE status to `cancelled` where `channex_booking_id` matches |

Using upsert for both `new` and `modified` simplifies the logic -- if Channex sends a "new" event for a booking we somehow already have, it won't error.

#### Booking Acknowledgment

After saving, acknowledge the revision so Channex knows we received it:

```typescript
await channexRequest('POST', `/api/v1/booking_revisions/${revisionId}/ack`, {});
// Then update acknowledged = true in our record
```

#### Error Handling Strategy

Always return HTTP 200 to Channex to prevent retries. Errors are logged to `channex_sync_logs` and console but don't affect the response status. This is critical -- Channex will keep retrying if they get non-200 responses.

```typescript
// Even on error, return 200
return new Response(JSON.stringify({ success: false, error: err.message }), {
  status: 200,
  headers: { "Content-Type": "application/json" },
});
```

#### Data Mapping to channex_bookings Columns

| channex_bookings column | Source |
|---|---|
| `channex_booking_id` | `payload.booking_id` |
| `channex_revision_id` | `payload.id` |
| `ota_name` | `payload.ota_name` |
| `ota_reservation_code` | `payload.ota_reservation_code` |
| `property_id` | Resolved from `channex_mappings` using Channex property ID |
| `room_type_id` | Resolved from first room in `payload.rooms` (nullable) |
| `rate_plan_id` | Resolved from first room's rate plan (nullable) |
| `status` | `payload.status` ("new", "modified", "cancelled") |
| `guest_name` | `customer.name + customer.surname` |
| `guest_email` | `customer.mail` |
| `guest_phone` | `customer.phone` |
| `arrival_date` | `payload.arrival_date` |
| `departure_date` | `payload.departure_date` |
| `total_amount` | `parseFloat(payload.amount)` |
| `currency` | `payload.currency` |
| `booking_data` | Full raw payload (JSONB) for reference |
| `acknowledged` | Set to `true` after successful ACK |

#### Config Entry

```toml
[functions.channex-booking-webhook]
verify_jwt = false
```

---

### Function Structure

1. **CORS handling** -- Standard preflight response
2. **Method validation** -- POST only
3. **Parse webhook body** -- Extract event type, property ID, payload
4. **Validate event** -- Ensure it's a "booking" event
5. **Resolve local property ID** -- Look up from `channex_mappings` by Channex property ID
6. **Resolve room type and rate plan** -- Best-effort from rooms array
7. **Build booking record** -- Map all fields to `channex_bookings` columns
8. **Execute database operation** -- Insert, update, or cancel based on status
9. **Acknowledge revision** -- POST to Channex ACK endpoint
10. **Log sync** -- Record in `channex_sync_logs`
11. **Return 200** -- Always, even on error

