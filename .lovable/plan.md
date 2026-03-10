

## Fix: Add revision-based idempotency check to prevent duplicate webhook processing

### Problem
The screenshot shows two log entries at the same timestamp (Mar 10, 14:28) for the same booking. Channex sometimes fires the webhook twice for the same revision, causing duplicate processing.

### Root Cause
The webhook logs every incoming request immediately (line 37-48) before any dedup check, then processes the full booking. There is no guard against processing the same `revision_id` twice.

### Fix in `supabase/functions/channex-booking-webhook/index.ts`

After extracting `revisionId` (line 69) and before the test payload detection (line 73), add:

```typescript
// Idempotency: skip if this revision was already processed
if (revisionId && !String(revisionId).startsWith('test-')) {
  const { data: alreadyProcessed } = await supabase
    .from("channex_bookings")
    .select("id")
    .eq("channex_revision_id", revisionId)
    .eq("acknowledged", true)
    .maybeSingle();

  if (alreadyProcessed) {
    console.log("[channex-booking-webhook] Revision already processed:", revisionId);
    return ok({ success: true, booking_id, status: "already_processed", revision_id: revisionId });
  }
}
```

**Why `channex_bookings` instead of `channex_sync_logs`?**
- The `channex_bookings` table already stores `channex_revision_id` and `acknowledged` flag
- Checking `acknowledged = true` means we only skip if the previous call fully completed (including ACK)
- Using `channex_sync_logs` with `contains` on JSONB would be slower and less reliable

**Also**: Move the immediate log insert to **after** the idempotency check so duplicate calls don't create duplicate log entries either. The log insert at lines 37-48 should be moved to after the dedup guard (but before the main processing logic).

### Changes
- **File**: `supabase/functions/channex-booking-webhook/index.ts`
  - Add revision idempotency check after line 71
  - Move the immediate log insert (lines 37-48) to after the idempotency check for booking events (keep it before for non-booking events)

