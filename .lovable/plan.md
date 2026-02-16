

## Overwrite Room Names and Verify System-Wide Consistency

### Step 1: Database Update

Run the following SQL to copy `booking_com_name` into `name` for every room:

```sql
UPDATE units
SET name = booking_com_name
WHERE booking_com_name IS NOT NULL
  AND name != booking_com_name;
```

This affects 11 of 12 rooms (Family Suite already matches). After this, both fields will hold identical guest-facing names.

---

### Step 2: Verification Query

After the update, run a confirmation query to display the updated state:

```sql
SELECT unit_number, name, booking_com_name FROM units ORDER BY unit_number;
```

Expected result -- all rows will match:

| Room # | name | booking_com_name |
|--------|------|-----------------|
| 417/418 | Family Suite | Family Suite |
| 501 | Suite with Terrace | Suite with Terrace |
| 502 | Suite with Terrace | Suite with Terrace |
| 503 | Junior Suite | Junior Suite |
| 504 | Double Room with Terrace | Double Room with Terrace |
| 505 | Suite with Terrace | Suite with Terrace |
| 506 | Deluxe Suite | Deluxe Suite |
| 509 | Deluxe Suite | Deluxe Suite |
| 511 | Deluxe Suite | Deluxe Suite |
| 512 | Deluxe Suite | Deluxe Suite |
| 517 | Junior Suite | Junior Suite |
| 518 | Deluxe Suite | Deluxe Suite |

---

### Step 3: No Code Changes Needed

Because both fields will now contain the same value, every code reference will automatically return the correct name regardless of which field it reads. Here is the full audit:

**Frontend files referencing unit name fields (27 files) -- all safe:**

All use either `booking_com_name || name` (already correct) or just `name` (now correct after update):

- `src/components/Dashboard.tsx` -- uses `booking_com_name || name`
- `src/components/RoomCalendar.tsx` -- uses `booking_com_name || name`
- `src/components/WeeklyCalendar.tsx` -- uses `booking_com_name || name`
- `src/components/MobileCalendarView.tsx` -- uses `booking_com_name || name`
- `src/components/RoomSwapDialog.tsx` -- uses `booking_com_name || name`
- `src/components/RoomTransferDialog.tsx` -- uses `booking_com_name || name`
- `src/components/ReservationsList.tsx` -- uses `booking_com_name || name`
- `src/components/ReservationQuickActions.tsx` -- uses `name` (now correct)
- `src/components/AvailabilityCalendar.tsx` -- uses `name` in some places (now correct)
- `src/components/CreateReservationDialog.tsx` -- uses `name` (now correct)
- `src/components/CreateGuestAccountDialog.tsx` -- uses `name` (now correct)
- `src/components/BlockedDatesManager.tsx` -- uses `booking_com_name || name`
- `src/components/CheckInDialog.tsx` -- uses `booking_com_name || name`
- `src/components/CheckOutDialog.tsx` -- uses `booking_com_name || name`
- `src/components/InventorySelectionModal.tsx` -- uses `booking_com_name || name`
- `src/components/NotificationCenter.tsx` -- uses metadata
- `src/components/ConflictAlert.tsx` -- uses `booking_com_name || name`
- `src/pages/ReservationDetail.tsx` -- uses `booking_com_name || name`
- `src/pages/Guests.tsx` -- uses `name` (now correct)
- `src/pages/Analytics.tsx` -- uses `name` (now correct)
- `src/pages/GuestCheckIn.tsx` -- uses `booking_com_name || name`
- `src/pages/Rooms.tsx` -- uses both fields for display
- `src/pages/RoomTypes.tsx` -- uses `booking_com_name`
- `src/pages/Housekeeping.tsx` -- uses `booking_com_name || name`
- `src/pages/SelectionLanding.tsx` -- uses `booking_com_name || name`
- `src/pages/BookingFlow.tsx` -- uses `booking_com_name || name`
- `src/pages/ChannexDebug.tsx` -- uses `booking_com_name || name`

**Edge functions referencing unit name fields (9 functions) -- all safe:**

- `send-reservation-notification` -- uses `booking_com_name || name` (already correct)
- `send-checkin-notification` -- uses `booking_com_name || name` (already correct)
- `send-checkout-notification` -- uses `booking_com_name || name` (already correct)
- `send-mid-stay-cleaning-notifications` -- uses `booking_com_name || name` (already correct)
- `send-late-checkout-notification` -- uses `units?.name` only (now correct after update)
- `send-extension-notification` -- uses `units?.name` only (now correct after update)
- `sync-booking-gmail` -- uses `name` in logging and email data (now correct after update)
- `channex-sync-property` -- uses `booking_com_name || name` for room types (already correct)
- `parse-reservation-screenshot` -- uses both fields for matching (still works)

### Step 4: Email Template Verification

All email-sending functions will now display correct room names:

| Email Type | Function | Status |
|-----------|----------|--------|
| New Reservation | send-reservation-notification | Uses `booking_com_name \|\| name` -- correct |
| Check-in | send-checkin-notification | Uses `booking_com_name \|\| name` -- correct |
| Check-out | send-checkout-notification | Uses `booking_com_name \|\| name` -- correct |
| Late Check-out | send-late-checkout-notification | Uses `name` -- now correct after update |
| Extension | send-extension-notification | Uses `name` -- now correct after update |
| Mid-stay Cleaning | send-mid-stay-cleaning-notifications | Uses `booking_com_name \|\| name` -- correct |
| Modification | send-modification-notification | Receives name from frontend -- now correct |
| Cancellation | send-cancellation-notification | Receives name from frontend -- now correct |
| Room Change | send-room-change-notification | Receives name from frontend -- now correct |
| Gmail Sync | sync-booking-gmail | Uses `name` -- now correct after update |

---

### Summary

- **Database change**: 1 UPDATE statement affecting 11 rows
- **Code changes**: Zero. The data fix eliminates all mismatches.
- **Result**: Old suite type names ("One Bedroom Suite with Balcony", "Large One Bedroom Suite", etc.) will be completely gone from the database and will never appear in emails, notifications, or the UI again.

