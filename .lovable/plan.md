

## Fix: Dynamic Property Name in All Email Notifications

### Summary of Audit

**Functions with hardcoded property names (MUST FIX):**
1. **`send-reservation-notification`** — 7 instances of "ICONIA Zamalek - Boutique Stay & Wellness Residences" (lines 159, 245, 253, 315, 349, 683 in subject, body header, body text, location, footer, admin header)
2. **`send-cancellation-notification`** — 1 instance in footer (line 281)

**Functions with NO property name in subject/body (SHOULD ADD for consistency):**
3. **`send-checkin-notification`** — subject: "New Guest Checked In - [Guest] - Room #[N]" → add property name
4. **`send-checkout-notification`** — subject: "Guest Checked Out - [Guest] - Room #[N]" → add property name
5. **`send-modification-notification`** — subject: "Reservation Modified - [Guest] - Room #[N]" → add property name
6. **`send-extension-notification`** — subject: "Stay Extended - [Room] - [Guest]" → add property name
7. **`send-room-change-notification`** — subject: "Room Change - [Guest] ([Ref])" → no change needed (no property name used)
8. **`auto-shuffle-rooms`** — subject: "Room Shuffle Alert - [Guest] ([Ref])" → add property name
9. **`send-late-checkout-notification`** — subject: "Late Checkout Added - [Room] - [Guest]" → add property name

**Functions already using dynamic property names (NO FIX NEEDED):**
- `generate-daily-summary` — uses `property.name` ✓
- `generate-weekly-summary` — uses `property.name` ✓
- `generate-monthly-summary` — uses `property.name` ✓

**Functions that don't reference property names (NO FIX NEEDED):**
- `send-admin-notification` — generic alert, no property context
- `send-ticket-notification` — guest-facing ticket status
- `send-checkout-surveys` — guest-facing survey
- `send-survey-notification` — guest-facing survey

---

### Implementation Plan

#### Step 1: Create shared helper `_shared/property-utils.ts`

```typescript
export async function getPropertyName(supabase: any, propertyId: string | null): Promise<string> {
  if (!propertyId) return 'SuiteSpot';
  const { data } = await supabase
    .from('properties')
    .select('name')
    .eq('id', propertyId)
    .maybeSingle();
  return data?.name || 'SuiteSpot';
}
```

#### Step 2: Fix `send-reservation-notification`

- Import `getPropertyName` from shared utils
- After `unitId` lookup (line 98-110), also fetch `property_id` from the unit and call `getPropertyName`
- Replace all 7 hardcoded "ICONIA Zamalek..." strings with the dynamic `propertyName` variable
- Update subject formats:
  - Customer: `Booking Confirmation - ${unitName} at ${propertyName}`
  - Admin: `New Reservation at ${propertyName}`

#### Step 3: Fix `send-cancellation-notification`

- Import `getPropertyName`
- After resolving `propertyId` (line 74-82), call `getPropertyName`
- Replace footer hardcoded string (line 281) with `SuiteSpot • ${propertyName}`
- Update subject to include property: `Cancelled Booking - ${guest_names[0]} - ${checkInShort} to ${checkOutShort}${unit_number ? ` - Room #${unit_number}` : ''} at ${propertyName}`

#### Step 4: Add property name to `send-checkin-notification`

- Already has `propertyId` from reservation (line 58)
- Add `getPropertyName` call
- Update subject: `Guest Checked In - ${guestName} - Room #${roomNumber} at ${propertyName}`

#### Step 5: Add property name to `send-checkout-notification`

- Already has `propertyId` from reservation (line 58)
- Add `getPropertyName` call
- Update subject: `Guest Checked Out - ${guestName} - Room #${roomNumber} at ${propertyName}`

#### Step 6: Add property name to `send-modification-notification`

- Already receives `property_id` in request body (line 24)
- Add `getPropertyName` call
- Update subject: `Reservation Modified - ${guest_names[0]} - Room #${room_number} at ${propertyName}`

#### Step 7: Add property name to `send-extension-notification`

- Fetch `property_id` from reservation
- Add `getPropertyName` call
- Update subject: `Stay Extended - ${roomInfo} - ${guestName} at ${propertyName}`

#### Step 8: Add property name to `auto-shuffle-rooms`

- Already has property context in the shuffle logic
- Update subject: `Room Shuffle Alert - ${propertyName}`

#### Step 9: Add property name to `send-late-checkout-notification`

- Fetch `property_id` from reservation
- Add `getPropertyName` call
- Update subject: `Late Checkout Added - ${roomInfo} - ${guestName} at ${propertyName}`

#### Step 10: Deploy all modified edge functions

---

### What will NOT change
- Email layouts, colors, or design
- Sender email addresses
- Notification toggle / recipient logic
- WhatsApp messages
- Booking/reservation logic
- Summary report functions (already dynamic)

