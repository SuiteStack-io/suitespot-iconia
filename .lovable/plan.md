

## Fix: Save Arrival Hour from Channex Bookings

The `arrival_time` column already exists on the `reservations` table. The webhook just needs to extract and pass it through.

### Changes

**File:** `supabase/functions/channex-booking-webhook/index.ts` — 3 small edits:

1. **Extract arrival_hour** (after line 125, with other field extractions):
```typescript
const arrival_hour =
  enrichedData.arrival_hour || enrichedData.arrivalHour ||
  enrichedData.check_in_time || bookingData.arrival_hour || null;
```

2. **Include in update** (line 271-284, the existing reservation update block) — add `arrival_time: arrival_hour` to the update object.

3. **Include in insert** (line 342-362, the new reservation record) — add `arrival_time: arrival_hour` to the `reservationRecord` object.

No database migration needed. No UI changes needed — `arrival_time` is already displayed in the Reservation Details page.

