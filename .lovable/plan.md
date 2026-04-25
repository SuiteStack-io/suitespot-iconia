## Goal

Stop the calendar from flagging late-checkout fee rows as "Double Booking Conflicts". The fee row (booking_reference ends `-LC`, same-day check_in == check_out) is a billing entry, not a stay. The unit is still correctly blocked via `blocked_dates`.

## Audit results

I searched every site that detects overlap/conflicts. Here's the verdict per file:

| File | Detection method | Currently flags LC fee? | Action |
|---|---|---|---|
| `src/components/AvailabilityCalendar.tsx` `detectConflicts` (L523) | `eachDayOfInterval(checkIn → checkOut-1)` then group `>1` per unit/date | **Yes** — fee row's `eachDayOfInterval(d, d-1)` returns `[d]`, collides with original's checkout-eve day in some month-cell renderings | Filter out `-LC` same-day rows at top of function |
| `src/components/AvailabilityCalendar.tsx` PDF export `getExportDayAvailability` (L1218) | `dayReservations` includes same-day via `isCheckInDay`; `stayingOvernight` filter then requires `date < checkOut` | `hasConflict` uses `stayingOvernight` (L1241) → **No conflict flag**. But `dayReservations` itself includes the fee row, which is then rendered to the PDF (L1742-1753) as "Booked: …" | Filter `dayReservations` to exclude `-LC` same-day rows so the PDF doesn't print a phantom booking on checkout day |
| `src/components/MobileCalendarView.tsx` `getDayData` (L205) | `dayReservations` filter includes `isCheckInDay`; groups by unit, flags `>1` (L226) | **Yes** — fee row's check-in day == original's checkout day (when status is completed/checked-out) | Filter out `-LC` same-day rows from `dayReservations` |
| `src/components/RoomCalendar.tsx` `hasConflict` (L164) | `date >= checkIn && date < checkOut` | Strict `<` → fee row (checkIn == checkOut) is excluded automatically. **No** | No change needed |
| `src/components/RoomCalendar.tsx` `getDayData` (L300) | Filter uses `isCheckInDay \|\| isStayingDay`, then groups (L321) | **Yes** — same-day fee matches `isCheckInDay` and lands in the same unit bucket as the staying-overnight original on its last night? Original's last night is the day BEFORE checkout, not the checkout day, so the original won't be in this bucket on checkout day. But two fee rows would, or any other future reservation checking in on that day. To match other calendars and keep behaviour consistent → filter | Filter out `-LC` same-day rows from `dayReservations` |
| `src/components/WeeklyCalendar.tsx` `hasConflict` (L95) | `date >= checkIn && date < checkOut` | Strict `<` → **No** | No change needed |
| `src/components/ConflictAlert.tsx` `checkForConflicts` (L46) | `r1.check_in_date < r2.check_out_date && r1.check_out_date > r2.check_in_date` | Same-day fee row (checkIn == checkOut) creates an empty range; the `<` strict check makes one half false in every pairing → **No**. But the fee row would still be paired with the parent for the listing if statuses both equal "confirmed" — verified: fee row status is `'completed'` (per `useLateCheckout.ts` line 124, status = `'completed'`), and the alert filters `status = 'confirmed'`, so it never enters the loop | No change needed |
| `src/components/RoomTransferDialog.tsx` (L136), `BookingComReservations.tsx` (L216, 489, 728, 826), `ReservationDetail.tsx` (L330) | All use RPC `check_reservation_overlap` which is strict `<`/`>` | **No** | No change needed |
| `src/components/RoomSwapDialog.tsx` overlap (L66) | Uses strict `<`/`>` overlap | **No** | No change needed |
| `src/components/MoveGuestSplitDialog.tsx` | No overlap detection (creates linked reservations only) | n/a | No change needed |
| `supabase/functions/auto-assign-rooms/index.ts` "Room Conflict Cannot Be Resolved" email (L442/472) | Triggered when new booking can't be placed via the strict RPC | Fee rows are inserted directly with their pre-assigned `unit_id` via `useLateCheckout`, do not run through `auto-assign-rooms`. **No** | No change needed |
| `supabase/functions/auto-shuffle-rooms/index.ts` (L121, 151) | Strict `<`/`>` overlap | Same-day rows excluded automatically | No change needed |
| DB triggers `prevent_reservation_overlap` (migration 20251118151945, 20260110125230) | Strict `<`/`>` daterange | **No** — fee row already passes (it inserted successfully after the `valid_dates` fix) | No change needed |

## Helper

Add a small shared helper to keep the filter consistent. New file `src/lib/reservationFilters.ts`:

```ts
export const isLateCheckoutFeeRow = (r: { booking_reference?: string | null; check_in_date: string; check_out_date: string }) =>
  !!r.booking_reference?.endsWith('-LC') && r.check_in_date === r.check_out_date;
```

Imported in the three files below. Mirrors the exact pattern at `ReservationQuickActions.tsx:891` and `ReservationDetail.tsx:257`.

## Changes

1. **Create `src/lib/reservationFilters.ts`** with the helper above.

2. **`src/components/AvailabilityCalendar.tsx`**
   - `detectConflicts` (L523): at the top, derive `realReservations = reservationsList.filter(r => !isLateCheckoutFeeRow(r))` and use it in the `forEach` loop. Existing call signature unchanged.
   - PDF export `getExportDayAvailability` (L1221): apply the same filter inside the `(exportReservations || []).filter(...)` so phantom "Booked" rows do not appear in the PDF on checkout day.

3. **`src/components/MobileCalendarView.tsx`**
   - `getDayData` (L205): filter out fee rows from `dayReservations` before grouping (`bookingsByUnit`, `hasConflict`, `bookingCount`).

4. **`src/components/RoomCalendar.tsx`**
   - `getDayData` (L300): filter out fee rows from `dayReservations` (consistent behaviour with other calendars; also prevents the day's `bookingCount` from including a phantom booking).

No other files require changes — every other overlap site uses strict-`<`/`>` semantics or the DB RPC, both of which already exclude empty same-day ranges. ConflictAlert is additionally protected by its `status = 'confirmed'` filter (LC fee rows have status `'completed'`).

## Out of scope / unchanged

- Fee row structure (`booking_reference` `-LC`, status `'completed'`, check_in == check_out, zero nights, zero commission).
- `blocked_dates` entry created alongside the fee row — still blocks the unit on the checkout day.
- `valid_dates` DB constraint and `check_reservation_overlap` RPC.
- Channex availability sync.
- Detection of true double bookings (two real reservations) — strict `<`/`>` and the new `-LC` filter both keep this intact.

## Acceptance criteria mapping

1. Apply Late Checkout → `detectConflicts` skips the fee row → no "1 Conflict" badge or red cell. ✅
2. Unit cell on checkout day still shows "Blocked" via the `blocked_dates` entry — untouched. ✅
3. Two real overlapping reservations (neither matches the LC filter) still flagged. ✅
4. Removing late checkout deletes both the fee row and the blocked entry — already implemented in `useLateCheckout.removeLateCheckout`; no change. ✅
