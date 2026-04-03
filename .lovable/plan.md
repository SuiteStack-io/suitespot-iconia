

## Add Message Webhook URL to Channex Connection Tab

### Changes

**File: `src/components/channex/ConnectionStatus.tsx`**

1. Add a `MESSAGE_WEBHOOK_URL` constant next to the existing `WEBHOOK_URL` (line 71)
2. Add a separate `copiedMessage` state for the second copy button
3. Add a `copyMessageWebhookUrl` function
4. Restructure the webhook section (lines 383-397) to show both URLs under a "Webhook URLs" heading:
   - **Booking Webhook** with its URL, copy button, and description mentioning the `booking` event
   - **Message Webhook** with its URL, copy button, and description mentioning the `message` event
5. No changes needed to the health check — it already checks the Channex API connection and system health, not individual webhook endpoints. The health check tests API connectivity, sync errors, queue backlog, etc. which covers both webhooks.

### Technical Details

- Add `const MESSAGE_WEBHOOK_URL = 'https://phvduifvymozqiqwvajj.supabase.co/functions/v1/channex-message-webhook'`
- Add `const [copiedMessage, setCopiedMessage] = useState(false)` state
- Add `copyMessageWebhookUrl` async function (same pattern as `copyWebhookUrl`)
- Replace the single webhook box with two stacked webhook entries, each with label, description, URL code block, and copy button
- Section header changes from "Webhook URL" to "Webhook URLs"

