

## Fix Channex Booking Webhook

### Problem Summary

The webhook function exists and is deployed, but has two issues:
1. Channex is not sending webhooks to it (no calls recorded at all)
2. The payload parsing assumes a flat structure, but Channex sends a nested one

### What You Need to Do (in Channex Dashboard)

Register this webhook URL in your Channex account settings:

```
https://phvduifvymozqiqwvajj.supabase.co/functions/v1/channex-booking-webhook
```

Subscribe to the `booking` event type. This is done in the Channex dashboard under Webhooks/Subscriptions for your property.

### Code Fix: Update Payload Parsing

The current code destructures `payload` directly:
```
const { event, property_id, payload } = body;
const { id, booking_id, status, ... } = payload;  // WRONG - booking data is nested deeper
```

Channex actually sends:
```json
{
  "event": "booking",
  "payload": {
    "booking": { "id": "...", "booking_id": "...", "customer": {...}, ... },
    "property_id": "channex-property-id"
  }
}
```

The fix makes the parser handle BOTH the nested format (payload.booking) and the flat format (payload directly), so it works regardless of which format Channex sends.

### Changes to `supabase/functions/channex-booking-webhook/index.ts`

Replace the payload extraction section (lines 28-47) with flexible parsing that:
- Reads `property_id` from `payload.property_id` OR top-level `body.property_id`
- Reads booking data from `payload.booking` (nested) OR `payload` directly (flat)
- Extracts guest email from both `customer.email` and `customer.mail` (Channex uses both)
- Handles `total_amount` as either a string or number field (Channex sends it as `amount` sometimes)

### Display Webhook URL on Connection Page

Add a clearly visible webhook URL section to the `ConnectionStatus.tsx` component so you always have it handy. It will show:
- The full webhook URL with a copy button
- A note reminding you to register it in Channex

### Technical Details

**File: `supabase/functions/channex-booking-webhook/index.ts`**

Updated parsing logic:

```text
const body = await req.json();
console.log("[channex-booking-webhook] Received:", JSON.stringify(body));

const event = body.event;

// Handle both nested and flat payload formats
const rawPayload = body.payload || {};
const bookingData = rawPayload.booking || rawPayload;
const channexPropertyId = rawPayload.property_id || body.property_id;

// Extract fields from booking data
const revisionId = bookingData.revision_id || bookingData.id;
const booking_id = bookingData.booking_id || bookingData.id;
const status = bookingData.status;
const ota_name = bookingData.ota_name;
const ota_reservation_code = bookingData.ota_reservation_code;
const arrival_date = bookingData.arrival_date;
const departure_date = bookingData.departure_date;
const customer = bookingData.customer;
const rooms = bookingData.rooms;
const amount = bookingData.amount || bookingData.total_amount;
const currency = bookingData.currency;
```

Guest email extraction also updated:
```text
const guestEmail = customer?.email || customer?.mail || "unknown@unknown.com";
```

**File: `src/components/channex/ConnectionStatus.tsx`**

Add a webhook URL info card above the health check button showing:
- The webhook endpoint URL
- A copy-to-clipboard button
- Instructions to register it in Channex

