
## Plan: Fix Checkout Email - Timestamp and Subject Line

### Problems Identified

1. **Checkout timestamp shows "Not recorded"**: The edge function fetches the reservation after the status update, but there's a race condition - the database might not have fully committed the `checked_out_at` timestamp yet when the fetch happens.

2. **Email subject shows suite name instead of guest name**: Currently shows "Guest Checked Out - Large One Bedroom Suite - Room #511" but should show "Guest Checked Out - Rawan Tarabzoni - Room #511"

---

### Solution

**Fix 1**: Pass the checkout timestamp directly to the edge function instead of relying on re-fetching from database

**Fix 2**: Update the email subject to use guest name instead of unit name

---

### Technical Changes

#### File: `supabase/functions/send-checkout-notification/index.ts`

**1. Update the interface to accept timestamp (line 12-15)**:
```typescript
interface CheckOutNotificationRequest {
  reservationId: string;
  userId?: string;
  checkedOutAt?: string; // New parameter
}
```

**2. Update timestamp logic (line 120-131)**:
```typescript
// Use the timestamp passed in, or fall back to the one from database
const checkedOutAt = checkedOutAtParam || reservation.checked_out_at 
  ? new Date(checkedOutAtParam || reservation.checked_out_at).toLocaleString('en-US', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  : 'Not recorded';
```

**3. Update email subject (line 139)**:
```typescript
// Before
subject: `Guest Checked Out - ${unitName} - Room #${roomNumber}`,

// After
subject: `Guest Checked Out - ${guestName} - Room #${roomNumber}`,
```

---

#### File: `src/pages/CheckInOut.tsx`

**Pass timestamp to edge function (line 237-239)**:
```typescript
await supabase.functions.invoke('send-checkout-notification', {
  body: { 
    reservationId, 
    userId: user?.id,
    checkedOutAt: new Date().toISOString() // Pass the timestamp
  }
});
```

---

#### File: `src/components/Dashboard.tsx`

**Pass timestamp to edge function (line 503-505)**:
```typescript
await supabase.functions.invoke('send-checkout-notification', {
  body: { 
    reservationId, 
    userId: user?.id,
    checkedOutAt: new Date().toISOString() // Pass the timestamp
  }
});
```

Also update bulk checkout (line 674-676) with the same pattern.

---

#### File: `src/components/ReservationQuickActions.tsx`

**Pass timestamp to edge function (line 418-420)**:
```typescript
await supabase.functions.invoke('send-checkout-notification', {
  body: { 
    reservationId: reservation.id, 
    userId: user?.id,
    checkedOutAt: new Date().toISOString() // Pass the timestamp
  }
});
```

---

### Summary of Changes

| File | Changes |
|------|---------|
| `supabase/functions/send-checkout-notification/index.ts` | Add `checkedOutAt` param, use it for timestamp, change email subject to use guest name |
| `src/pages/CheckInOut.tsx` | Pass `checkedOutAt` timestamp when invoking function |
| `src/components/Dashboard.tsx` | Pass `checkedOutAt` timestamp in all checkout function calls |
| `src/components/ReservationQuickActions.tsx` | Pass `checkedOutAt` timestamp when invoking function |

---

### Expected Result

Email subject will change from:
> "Guest Checked Out - Large One Bedroom Suite - Room #511"

To:
> "Guest Checked Out - Rawan Tarabzoni - Room #511"

And the "Checked Out At" field will show the actual timestamp instead of "Not recorded".
