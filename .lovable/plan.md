

## Add "Checked In/Out By" Field + Change Sender Email

### Changes

**1. Frontend: Pass `userId` to check-in notification (4 files)**

Check-out calls already pass `userId`. Check-in calls do not. Update all `send-checkin-notification` invocations in:
- `src/components/Dashboard.tsx` (3 call sites)
- `src/components/ReservationQuickActions.tsx` (1 call site)
- `src/pages/CheckInOut.tsx` (2 call sites)
- `src/pages/GuestCheckIn.tsx` (1 call site — this is guest-initiated, so no userId available; will show "Guest (Self Check-In)" as fallback)

Pattern: get user before the call and pass `userId: user?.id` in the body, same as checkout already does.

**2. Edge Function: `send-checkin-notification/index.ts`**

- Accept `userId` from request body
- Look up staff name from `profiles` table (fallback: "System")
- Add "Checked In By:" row inside the green-highlighted section, below the "Checked In At:" row, styled identically
- Change sender from `"SuiteSpot Reservations <reservations@bookings.suitespoteg.com>"` to `"SuiteSpot Front Desk <frontdesk@bookings.suitespoteg.com>"`

**3. Edge Function: `send-checkout-notification/index.ts`**

- Move the "Checked out by:" text from outside the yellow box into the yellow Room Details table as a proper row after "Checked Out At:", styled like the other rows
- Change sender from `"SuiteSpot Housekeeping <housekeeping@bookings.suitespoteg.com>"` to `"SuiteSpot Front Desk <frontdesk@bookings.suitespoteg.com>"`

### What stays the same
- Recipient logic, notification preferences, rate limiting — all untouched
- All other email types keep their current sender
- Email layout/colors unchanged beyond the specified additions

