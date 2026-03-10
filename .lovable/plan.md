

## Fix: Duplicate Sync Logs and Wrong Property ID

### Root Cause

Two separate issues in `channex-booking-webhook/index.ts`:

**1. Duplicate log entries:**
- Line 88-102: An "immediate" sync log is inserted using `body.property_id` (the raw Channex property ID) BEFORE the local property is resolved.
- Line 436: A second sync log is inserted via `logSync()` at the end, this time using the correctly resolved `localPropertyId`.
- Result: every successful webhook produces TWO log entries.

**2. Wrong property name on first log:**
- The immediate log (line 98) stores `body.property_id` which is the **Channex** property UUID (`f4725a4c-...`), not the local property UUID. Since this UUID doesn't exist in the `properties` table, the `SyncLogs` component falls back to showing the first 8 chars of the UUID.

### Fix

**Remove the immediate sync log insert (lines 87-102).** The final `logSync()` call at line 436 already logs the event with the correct `localPropertyId` after resolution. The idempotency check (lines 72-85) already prevents duplicate processing, so there's no need for an early log.

This is a single deletion in `supabase/functions/channex-booking-webhook/index.ts` — remove lines 87-102 (the `immediateLogError` block for booking events). The non-booking immediate log at lines 38-54 is fine since those events don't go through property resolution.

**File:** `supabase/functions/channex-booking-webhook/index.ts` — delete ~16 lines.

