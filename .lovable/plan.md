

## Send Reservation Modification Email Notification

### Summary
After a reservation is successfully updated via the modification flow, send an email notification to all admin/manager/front_desk users with details showing the before vs after changes (dates and amounts), including the room's booking.com name and number.

---

### Technical Changes

#### 1. Create New Edge Function: `supabase/functions/send-modification-notification/index.ts`

Create a new edge function similar to `send-room-change-notification` that sends a "Reservation Modification" email.

**Request Interface:**
```typescript
interface ModificationNotificationRequest {
  booking_reference: string;
  guest_names: string[];
  room_name: string;          // booking_com_name with fallback to name
  room_number: string;
  old_check_in: string;
  old_check_out: string;
  new_check_in: string;
  new_check_out: string;
  old_total_price: number;
  new_total_price: number;
  currency: string;
  channel?: string;
  source?: string;
}
```

**Email Template Design:**
- Header: Orange gradient with "Reservation Modified" title and sync icon
- Booking Reference: Prominent display
- Room Info: Shows booking.com name (#room_number)
- Date Changes: Side-by-side comparison with strikethrough on old dates
- Amount Changes: Side-by-side comparison with strikethrough on old amount
- Guest info and booking source

**Email Subject Format:**
`Reservation Modified - [Guest Name] - Room #[Number]`

#### 2. Update `supabase/config.toml`

Add configuration for the new edge function:
```toml
[functions.send-modification-notification]
verify_jwt = false
```

#### 3. Update Frontend: `src/pages/BookingComReservations.tsx`

**Modify `handleUpdateReservation` function (around line 1410):**

After the reservation updates are successful, fetch unit details and call the new edge function:

```typescript
// After successful updates, send modification notification
try {
  // Get the first reservation's unit details for room info
  const firstReservation = existingReservationsToUpdate[0];
  
  // Fetch unit details including booking_com_name
  const { data: unitData } = await supabase
    .from('units')
    .select('name, unit_number, booking_com_name')
    .eq('id', firstReservation.unit_id)
    .single();
  
  await supabase.functions.invoke('send-modification-notification', {
    body: {
      booking_reference: parsedData.bookingReference,
      guest_names: parsedData.guestNames || firstReservation.guest_names,
      room_name: unitData?.booking_com_name || unitData?.name || 'Unknown',
      room_number: unitData?.unit_number || 'N/A',
      old_check_in: originalReservationData.check_in_date,
      old_check_out: originalReservationData.check_out_date,
      new_check_in: parsedData.checkInDate,
      new_check_out: parsedData.checkOutDate,
      old_total_price: originalReservationData.total_price || 0,
      new_total_price: parsedData.totalPrice || 0,
      currency: parsedData.currency || 'USD',
      channel: firstReservation.channel,
      source: firstReservation.source,
    }
  });
  console.log('Modification notification sent');
} catch (notifyError) {
  console.error('Failed to send modification notification:', notifyError);
  // Don't fail the update if notification fails
}
```

---

### Email Template Visual Design

```text
┌──────────────────────────────────────────────┐
│      🔄 Reservation Modified                 │
│      A booking has been modified             │
├──────────────────────────────────────────────┤
│                                              │
│      Booking Reference                       │
│      ┌─────────────────────┐                 │
│      │    6083546298       │                 │
│      └─────────────────────┘                 │
│                                              │
│      Room: Double Room (#602)                │
│                                              │
├──────────────────────────────────────────────┤
│  DATES CHANGED                               │
│  ─────────────────────────────────────────   │
│  Before:  ̶F̶e̶b̶ ̶7̶ ̶-̶ ̶F̶e̶b̶ ̶1̶0̶,̶ ̶2̶0̶2̶5̶           │
│  After:   Feb 7 - Feb 12, 2025              │
│                                              │
│  AMOUNT CHANGED                              │
│  ─────────────────────────────────────────   │
│  Before:  $̶3̶4̶5̶.̶0̶0̶                          │
│  After:   $460.00                            │
│                                              │
├──────────────────────────────────────────────┤
│  👤 Guest: John Smith                        │
│  🏷️ Source: Booking.com                     │
└──────────────────────────────────────────────┘
```

---

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/send-modification-notification/index.ts` | Create new |
| `supabase/config.toml` | Add function config |
| `src/pages/BookingComReservations.tsx` | Add notification call |

---

### Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| Only dates changed | Shows date comparison, amount shows same value |
| Only amount changed | Shows amount comparison, dates show same value |
| Both changed | Shows both comparisons |
| Unit not found | Uses "Unknown" for room name |
| Notification fails | Logs error but doesn't fail the update |
| Multi-room booking | Uses first reservation's room info |

