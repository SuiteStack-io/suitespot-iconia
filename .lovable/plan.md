

## Fix: Deploy Channex Webhook with Email Notification Code

### Root Cause
The code to call `send-reservation-notification` already exists in the source file (lines 636-669 of `channex-booking-webhook/index.ts`). However, the edge function logs show NO notification-related log lines ("Sending new reservation notification") during recent booking creations — only "Reservation created" followed directly by ACK and availability push. This strongly indicates the **deployed version** of the function does not contain the notification code.

Additionally, there are two improvements needed in the existing code:

1. **Response body not consumed**: The `fetch()` call doesn't read the response body or check status, which means errors from `send-reservation-notification` are silently ignored
2. **`send-reservation-notification` has `verify_jwt = true`**: While the service role key is a valid JWT, this is inconsistent with other notification functions (all set to `verify_jwt = false`)

### Plan

#### 1. Fix notification fetch to log response status
**File**: `supabase/functions/channex-booking-webhook/index.ts` (lines 638-669)

Update the fetch call to consume the response and log the status:
```typescript
try {
  console.log("[channex-booking-webhook] Sending new reservation notification for:", resId);
  const notifResponse = await fetch(`${supabaseUrl}/functions/v1/send-reservation-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ ... }),
  });
  const notifText = await notifResponse.text();
  console.log("[channex-booking-webhook] New reservation notification response:", notifResponse.status, notifText);
} catch (notifErr: any) {
  console.error("[channex-booking-webhook] New reservation notification failed (non-fatal):", notifErr.message);
}
```

Apply the same pattern to the modification notification (lines 670-700) and cancellation notification (lines 701-734).

#### 2. Set `verify_jwt = false` for send-reservation-notification
**File**: `supabase/config.toml`

Change `verify_jwt = true` to `verify_jwt = false` for consistency with all other notification functions.

#### 3. Redeploy edge functions
Deploy both `channex-booking-webhook` and `send-reservation-notification` to ensure the latest code is live.

### Summary
- 2 files edited (webhook response handling + config.toml)
- Deploy 2 edge functions
- The notification code already exists — this fix ensures it's deployed and properly logs responses

