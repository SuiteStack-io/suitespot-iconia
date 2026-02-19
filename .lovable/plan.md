

## Add "Test Webhook" Button to Channex Connection Page

### What This Does

Adds a button on the Channex Integration connection tab that sends a fake booking to your webhook endpoint, then checks if it appeared in the database. This lets you verify the entire pipeline works without waiting for a real Channex booking.

### How It Works

1. You click "Test Webhook"
2. The app sends a simulated Channex booking payload (with a unique test reference like `TEST-1234567890`) directly to the webhook URL
3. It waits 2 seconds for processing
4. It queries the `channex_bookings` table for the test booking ID
5. Shows a success toast if found, or an error toast with details if not

### Changes

**File: `src/components/channex/ConnectionStatus.tsx`**

Add a "Test Webhook" button and handler:

- New state: `testing` (boolean for loading spinner)
- New function `testWebhook()` that:
  - Generates a unique test booking ID (`test-booking-{timestamp}`)
  - Sends a POST to the webhook URL with a realistic fake payload including event type, nested booking data, property ID, customer info, dates, and amount
  - Waits briefly, then queries `channex_bookings` for the test record
  - Shows success/error feedback via toast
  - Cleans up the test record from the database after verification
- New button placed next to the "Run Health Check" button with a `FlaskConical` icon
- The test payload uses a clearly identifiable `ota_name: "Test"` and `ota_reservation_code: "TEST-..."` so test records are easy to spot

### Important Notes

- The test sends the request directly to the webhook URL (not through `supabase.functions.invoke`) since the webhook is designed to receive unauthenticated POST requests from Channex
- The test booking is automatically deleted after verification so it doesn't pollute your bookings list
- If property mapping lookup fails inside the webhook, the test will report that specific error rather than a generic failure

