

## Fix: Channex Webhook Not Logging to Sync Logs

### Root Cause (Two Issues Found)

**Issue 1: Foreign key mismatch on `channex_sync_logs.property_id`**

The `channex_sync_logs` table has a foreign key: `property_id -> units(id)`. But the webhook passes a **property mapping local_id** (from `channex_mappings`), which references a property concept -- not a unit. This causes every `logSync()` insert to silently fail with a foreign key violation. This is confirmed by the edge function logs from the property sync, which show the exact error:

```
Key (property_id)=(e30ad118-...) is not present in table "units"
```

This means **every single webhook call has been failing to log**, which is why `channex_sync_logs` has zero rows for `channex-booking-webhook`.

**Issue 2: Non-booking events are not logged**

When Channex sends a "test" event (which is what the "Test Webhook" button sends), the function returns early at line 32 without writing anything to `channex_sync_logs`. So even if the FK issue were fixed, test events would still produce no log.

### Fix

**1. Database Migration: Drop the broken foreign key**

The `property_id` column in `channex_sync_logs` should be a plain UUID without a foreign key, since it stores property-level IDs (not unit IDs):

```sql
ALTER TABLE channex_sync_logs DROP CONSTRAINT channex_sync_logs_property_id_fkey;
```

**2. Edge Function: Log non-booking events before returning**

Add an immediate log entry for ALL incoming requests (including "test" events) so you always have visibility:

```text
// Right after parsing the body and before the event check:
// 1. Create supabase client early
// 2. Log the incoming request immediately
// 3. Then check event type and proceed
```

Specific changes to `channex-booking-webhook/index.ts`:
- Move the `supabase` client creation to right after parsing the JSON body (before the event check on line 32)
- Before the `if (event !== "booking")` check, insert a log entry recording the raw payload
- For non-booking events, still log them before returning the "ignored" response

### Files Modified
- **Database migration**: Drop FK constraint on `channex_sync_logs.property_id`
- **`supabase/functions/channex-booking-webhook/index.ts`**: Move supabase init earlier, add immediate logging for all events
