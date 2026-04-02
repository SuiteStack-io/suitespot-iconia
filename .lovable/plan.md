

## Add Late Checkout Time Feature with OTA Availability Sync

### What this does
Adds a `late_checkout_time` column to reservations, and a shared hook + dialog component that blocks the unit on checkout day (via the `blocked_dates` table) when a late checkout time is set. The existing database trigger on `blocked_dates` automatically syncs availability to Channex/OTAs.

### Safety constraints
- Late checkout blocks use reason prefix `"Late checkout - "` (e.g., `"Late checkout - 2:00 PM"`)
- When removing a late checkout, the DELETE query filters by ALL three fields: `unit_id`, `date`, AND `reason ILIKE 'Late checkout%'`
- This ensures manually created blocks (from the Blocked Dates Manager) are never affected
- If a unit already has a separate manual block on the checkout date, the late checkout creates its own independent entry

### Changes

#### 1. Database Migration
```sql
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS late_checkout_time time WITHOUT time zone;
```

#### 2. New Hook: `src/hooks/useLateCheckout.ts`
- Accepts: `reservation_id`, `unit_id`, `unit_name`, `checkout_date`
- `applyLateCheckout(time)`:
  1. Inserts into `blocked_dates` for `unit_id` on `checkout_date` with reason `"Late checkout - [time]"`
  2. Updates `reservations.late_checkout_time = time`
  3. DB trigger handles Channex sync
- `removeLateCheckout()`:
  1. Deletes from `blocked_dates` WHERE `unit_id = X` AND `blocked_date = checkout_date` AND `reason ILIKE 'Late checkout%'`
  2. Sets `reservations.late_checkout_time = null`
  3. DB trigger handles Channex sync

#### 3. New Component: `src/components/LateCheckoutDialog.tsx`
Reusable dialog for both Quick Actions and Reservation Details:
- **Apply mode**: Time picker (1 PM–8 PM), info message with unit name and date, OTA sync warning, "Save Changes" / "Discard Changes" buttons
- **Remove mode**: Confirmation message, same button pair
- Success toasts with details

#### 4. Update: `src/components/ReservationQuickActions.tsx`
- Existing "Late Checkout" button opens `LateCheckoutDialog`
- Button label toggles to "Remove Late Checkout" when `late_checkout_time` is set
- Only for `confirmed` / `checked-in` status; disabled if no unit assigned

#### 5. Update: `src/pages/ReservationDetail.tsx`
- Add "Late Checkout" / "Remove Late Checkout" button in action area
- Display "Late Checkout: [time]" in Booking Details when set
- Same status/unit constraints as Quick Actions

### Summary
- 1 migration (add column)
- 2 new files (hook + dialog)
- 2 files edited (ReservationQuickActions, ReservationDetail)
- DELETE safety: always filters by `unit_id` + `date` + `reason ILIKE 'Late checkout%'`
- Manual blocks are never touched

