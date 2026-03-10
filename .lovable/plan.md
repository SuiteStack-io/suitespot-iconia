

## Move Channex ID to Booking Details Section

### Current State
- Channex ID is displayed in the header area (line 931-933), right after the booking reference
- The Booking Details card (line 1219) has a read-only section starting at line 1490 with fields like Room Name, Unit Number, Check-in/out, pricing, Source, Channel, etc.

### Change
1. **Remove** the Channex ID from the header (lines 931-933)
2. **Add** it to the read-only Booking Details section, after the Channel field (around line 1615), as:
```tsx
{reservation.channex_booking_id && (
  <div>
    <Label className="text-muted-foreground">Channex ID</Label>
    <p className="mt-1 font-medium">{reservation.channex_booking_id}</p>
  </div>
)}
```

**File:** `src/pages/ReservationDetail.tsx` — two small edits (delete 3 lines from header, add 6 lines in booking details).

