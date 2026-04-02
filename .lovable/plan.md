

## Fix: Disable Edit/Cancel Buttons for OTA Reservations

### Problem
OTA reservations (via Channex) can be accidentally edited or cancelled from the PMS, creating mismatches with the OTA platform.

### Fix
**File: `src/pages/ReservationDetail.tsx`**

Add a helper constant after reservation data is loaded:
```ts
const isOtaReservation = reservation?.channel === 'Channex' || 
  ['BookingCom', 'Booking.com', 'Airbnb', 'Expedia', 'VRBO', 'Agoda', 'Hotels.com'].includes(reservation?.source || '');
const otaSourceLabel = reservation?.source || reservation?.channel || 'the OTA';
```

At line 1080, wrap the Edit Reservation button with a Tooltip and disable it when `isOtaReservation`:
```tsx
<Button onClick={() => setIsEditMode(true)} disabled={isOtaReservation}
  title={isOtaReservation ? `This reservation was made through ${otaSourceLabel}. It can only be modified through the ${otaSourceLabel} platform.` : undefined}>
  <Edit2 className="h-4 w-4 mr-2" />
  Edit Reservation
</Button>
```

At line 1096, same for Cancel Reservation button:
```tsx
<Button variant="destructive" onClick={() => setShowDeleteDialog(true)} disabled={isOtaReservation}
  title={isOtaReservation ? `This reservation was made through ${otaSourceLabel}. It can only be cancelled through the ${otaSourceLabel} platform.` : undefined}>
  <Trash2 className="h-4 w-4 mr-2" />
  Cancel Reservation
</Button>
```

### Summary
- 1 file edited
- 2 buttons get `disabled` + `title` tooltip for OTA reservations
- Manual/direct reservations unaffected

