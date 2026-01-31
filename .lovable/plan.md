

## Plan: Update Check-In and Check-Out Email Subject Lines

### Summary

Change the email subject line format for both check-in and check-out notifications to display the guest name instead of the suite name.

---

### Current vs Target Format

| Email Type | Current Subject | Target Subject |
|------------|----------------|----------------|
| Check-in | `New Guest Checked In - ${unitName} - Room #${roomNumber}` | `New Guest Checked In - ${guestName} - Room #${roomNumber}` |
| Check-out | `Guest Checked Out - ${guestName} - Room #${roomNumber}` | `Guest Checked Out - ${guestName} - Room #${roomNumber}` |

**Example:**
- Before: `New Guest Checked In - One Bedroom Suite with Balcony - Room #505`
- After: `New Guest Checked In - Ayedh Albugami - Room #505`

---

### Technical Changes

#### File 1: `supabase/functions/send-checkin-notification/index.ts`

**Line 83** - Update the email subject:

```typescript
// Before
subject: `New Guest Checked In - ${unitName} - Room #${roomNumber}`,

// After
subject: `New Guest Checked In - ${guestName} - Room #${roomNumber}`,
```

The `guestName` variable is already defined at line 75:
```typescript
const guestName = reservation.guest_names[0] || 'Guest';
```

---

#### File 2: `supabase/functions/send-checkout-notification/index.ts`

**Line 116** - Verify/update the email subject:

```typescript
// Ensure it uses guestName (not unitName)
subject: `Guest Checked Out - ${guestName} - Room #${roomNumber}`,
```

The `guestName` variable is already defined at line 96:
```typescript
const guestName = reservation.guest_names[0] || 'Guest';
```

---

### Result

| Email | Subject Line |
|-------|-------------|
| Check-in | `New Guest Checked In - Ayedh Albugami - Room #505` |
| Check-out | `Guest Checked Out - rawan tarabzoni - Room #511` |

Both emails will now show the guest name in the subject line for quick identification in email inbox, with the room number for reference.

---

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/send-checkin-notification/index.ts` | Replace `${unitName}` with `${guestName}` in subject line |
| `supabase/functions/send-checkout-notification/index.ts` | Verify subject uses `${guestName}` |

