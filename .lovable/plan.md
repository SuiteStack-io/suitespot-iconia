

## Remove Duplicate "Unit" Field from Reservation Email

### Problem

In the new reservation notification email (`send-reservation-notification/index.ts`), two fields display the same room name:
- **Unit:** Family Suite
- **Room:** Family Suite

This happens because `unitName` (passed from the frontend) and `matchedRoomName` (fetched from the database) now contain the same value after the recent database sync.

### Audit Results

| Email Template | Has "Unit" field? | Has "Room" field? | Duplicate? |
|---|---|---|---|
| send-reservation-notification | Yes (line 674) | Yes (line 680) | **Yes -- needs fix** |
| send-cancellation-notification | "Unit: #number" (line 232) | "Room: name" (line 228) | No -- different data |
| send-checkin-notification | No | No | N/A |
| send-checkout-notification | No | No | N/A |
| send-modification-notification | No | No | N/A |
| send-extension-notification | No | No | N/A |
| send-late-checkout-notification | No | No | N/A |

Only `send-reservation-notification` has the duplication.

Note: The cancellation email shows "Room: [name]" and "Unit: #[number]" -- these are different pieces of information (name vs number), so no change is needed there. However, the label "Unit" is misleading since it shows a room number. This will be updated to "Room #:" for consistency.

### Changes

**File: `supabase/functions/send-reservation-notification/index.ts`**

1. **Remove the "Unit:" row** (lines 673-676) that displays `unitName`
2. **Make the "Room:" row always show** using `matchedRoomName || unitName` as a fallback, removing the conditional wrapper

The result will be a single "Room:" field followed by "Room #:" -- no more duplication.

**File: `supabase/functions/send-cancellation-notification/index.ts`**

3. **Rename "Unit:" label to "Room #:"** (line 232) since it displays a room number, not a name. This aligns terminology across all emails.

