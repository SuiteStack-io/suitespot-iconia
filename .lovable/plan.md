

## Fix: Improve Idempotency Check in Channex Booking Webhook

### Problem
The current idempotency check queries `channex_bookings` for `acknowledged=true`, but when two webhook calls arrive simultaneously, both can pass this check before either finishes processing (race condition). The premature log block was already removed in a prior edit.

### Change

**File:** `supabase/functions/channex-booking-webhook/index.ts` (lines 72-85)

Replace the idempotency check to query `channex_sync_logs` instead of `channex_bookings`. Since the sync log is written only at the **end** of successful processing, this ensures the second request sees the first one's completed log entry:

```typescript
// --- Idempotency: skip if this revision was already processed ---
if (revisionId && !String(revisionId).startsWith('test-')) {
  const { data: alreadyProcessed } = await supabase
    .from("channex_sync_logs")
    .select("id")
    .eq("function_name", "channex-booking-webhook")
    .filter("request_payload->payload->>revision_id", "eq", revisionId)
    .limit(1)
    .maybeSingle();

  if (alreadyProcessed) {
    console.log("[channex-booking-webhook] Revision already processed:", revisionId);
    return ok({ success: true, booking_id, status: "already_processed", revision_id: revisionId });
  }
}
```

Single edit, ~14 lines replaced.

