

## Fix: Channex Webhook Email Notifications Never Sent

### Root Cause

On line 656 of `channex-booking-webhook/index.ts`, the code fetches the full reservation for the notification payload:

```typescript
.select("*, units:unit_id(name, room_number, room_type)")
```

The `units` table does **not** have columns `room_number` or `room_type`. The actual columns are `unit_number` and `unit_type`. PostgREST returns a **400 error** when you select non-existent columns, causing `fullRes` to be `null`. Since all three notification branches (created/updated/cancelled) are inside `if (fullRes)`, none of them ever execute.

This is why `send-reservation-notification` shows 0 invocations — the code path that calls it is never reached due to the failed query.

### Fix

**File**: `supabase/functions/channex-booking-webhook/index.ts`

#### 1. Fix the select query (line 656)
Change:
```typescript
.select("*, units:unit_id(name, room_number, room_type)")
```
To:
```typescript
.select("*, units:unit_id(name, unit_number, unit_type)")
```

#### 2. Fix all references to the unit data (lines 661+)
Update `unitData` field references throughout the notification section:
- `unitData?.room_number` → `unitData?.unit_number`
- `unitData?.room_type` → `unitData?.unit_type`

This affects:
- Line 679: `unitName: unitData?.name` (already correct)
- Line 681: `unitType: unitData?.room_type` → `unitData?.unit_type`
- Line 711: `room_number: unitData?.room_number` → `unitData?.unit_number`

#### 3. Add error logging for the query
Add a log line after the query to catch future issues:
```typescript
if (!fullRes) {
  console.error("[channex-booking-webhook] Failed to fetch reservation for notification:", resId);
}
```

#### 4. Redeploy
Redeploy `channex-booking-webhook` to make the fix live.

### Summary
- 1 file edited (3 column name fixes + 1 error log)
- 1 edge function redeployed
- Root cause: PostgREST 400 error from querying non-existent columns silently nullified the result, skipping all notification calls

