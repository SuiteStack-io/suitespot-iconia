# Move Guest to New Room — Split Reservation Flow

Add a new action that splits an active reservation into two linked reservations when a guest changes rooms mid‑stay. Naming follows the existing "Split Stay" pattern from the Booking.com screenshot uploader.

## 1. Database migration

Add two columns to `reservations`:

```sql
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS parent_reservation_id UUID
    REFERENCES public.reservations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_split_reservation BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_reservations_parent
  ON public.reservations(parent_reservation_id)
  WHERE parent_reservation_id IS NOT NULL;
```

No RLS changes — inherits existing reservation policies.

## 2. UI — Reservation Quick Actions modal

File: `src/components/ReservationQuickActions.tsx` (around line 1709‑1719).

Replace the single full‑width "Swap Rooms with Another Reservation" button with a 2‑column grid of equal buttons:

- Left (existing): **Swap Rooms with Another Reservation** — opens `RoomSwapDialog`, no logic change.
- Right (new): **Move Guest to New Room** — opens the new `MoveGuestSplitDialog`.

The new button is rendered only when `reservation.status` is `confirmed` or `checked-in` (matches the project's existing dash status convention; we'll treat the spec's `checked_in` / `checked_out` as `checked-in` / `checked-out`).

## 3. New component — `MoveGuestSplitDialog`

New file: `src/components/MoveGuestSplitDialog.tsx`.

**Props:** `open`, `onOpenChange`, `reservation`, `currentUnit`, `onSplitComplete`.

**Read‑only header:**
- Guest name (`reservation.guest_names[0]`)
- Original reservation: `<currentUnit.name> — <check_in> → <check_out> (<nights> nights)`
- Current status badge

**Inputs:**
1. **Move Date** picker (shadcn Calendar in Popover, `pointer-events-auto`).
   - Min: max(today, check_in_date + 1 day).
   - Max: check_out_date − 1 day.
   - Default: today (clamped to the valid range).
2. **End Date** read‑only display: original `check_out_date` with caption "auto‑filled from original booking".
3. **New Room** dropdown — listed only after a valid Move Date is chosen.
   - Query `units` for the active `property_id`, exclude `status = 'maintenance'` and `id = currentUnit.id`.
   - For each unit, check via `check_reservation_overlap(unit_id, move_date, original_check_out, NULL)` and `blocked_dates` between move_date and (original_check_out − 1).
   - Show only units with no overlap / no blocks. Label: `#<unit_number> — <name>`.
4. **Pricing for new room** (radio):
   - "Same as original booking" — uses `reservation.price_per_night` (or `total_price / nights` fallback).
   - "Custom rate per night" — numeric input in property currency, must be > 0.

**Actions:** Cancel · Confirm Move (disabled until valid).

## 4. Confirm Move — backend logic (client‑side, sequential)

Supabase JS does not expose multi‑statement transactions, so we mirror the existing pattern: do the inserts/updates sequentially with explicit rollback on failure (matches how extension and shuffle flows already work). The DB trigger `notify_channex_availability_change` automatically handles Channex availability pushes on both the UPDATE (shortened original) and INSERT (new linked reservation), so no manual `channex-push-availability` call is needed.

Steps:

1. **Validate** all rules listed in §6.
2. **Shorten original reservation** — `update reservations`:
   - `check_out_date = move_date`
   - `total_price = price_per_night × new_nights` (the `nights` column is a generated column, no need to set it)
   - `commission_amount` and `net_revenue` recalculated from new total
   - `status` unchanged
   - Append a note: `Split on <move_date>: guest moved to Room <new_unit_number>`
3. **Insert new linked reservation** with:
   - All guest fields copied (`guest_names`, `contact_email`, `contact_phone`, `guest_nationality`, `guest_genders`, `guest_ages`, `adults`, `children`, `number_of_guests`, `preferred_language`, `guest_types`)
   - `unit_id` = new room, `property_id` = same
   - `check_in_date = move_date`, `check_out_date = original.check_out_date`
   - `price_per_night` from radio choice; `total_price = rate × new_nights`
   - `commission_rate` copied; `commission_amount`/`net_revenue` recalculated
   - `status = original.status` (typically `checked-in`)
   - `source`, `channel`, `currency`, `booking_reference`, `channex_booking_id`, `group_id` — all copied
   - `parent_reservation_id = original.id`, `is_split_reservation = true`
   - `notes`: `Moved from Room <original_unit_number> on <move_date>`
4. If insert fails, roll back the original reservation update (restore old check_out / total / notes) and surface a toast.
5. Both DB writes fire `notify_channex_availability_change`, queueing pushes for: original room (free for `move_date → original_check_out + 1`) and new room (booked for `move_date → original_check_out`).
6. **Audit log** — insert into `audit_logs`:
   - `action = 'split_reservation'`, `table_name = 'reservations'`, `record_id = original.id`
   - `changes` JSON: `{ new_reservation_id, move_date, original_unit_id, new_unit_id, original_unit_number, new_unit_number, rate_per_night, source, performed_by_name }`
7. Append a human‑readable line to the original reservation's `notes` so the timeline on the detail page surfaces it: `Guest moved from Room <X> to Room <Y> on <date> by <user>`.
8. Toast success, call `onSplitComplete()`, close dialog.

## 5. Check‑In/Out cards behavior

No change. The original reservation keeps `status = checked-in` and is still excluded from the Check‑In card (which already filters by status). The new linked reservation also has `status = checked-in` from the start, so it doesn't enter the Check‑In queue either. Both will appear in the Check‑Out card on their respective check‑out dates — correct behavior.

## 6. Validation rules (must all pass)

- `move_date >= today`
- `move_date > original.check_in_date`
- `move_date < original.check_out_date`
- `new_unit_id !== original.unit_id`
- New room has no reservation overlap and no blocked dates in `[move_date, original.check_out_date)`
- If custom rate: `rate > 0`

Each failure shows a clear toast and prevents submit.

## 7. Extension flow on split reservations

No code changes. The existing extension flow operates on whichever reservation is passed to it. When a user opens Quick Actions for the new (post‑split) reservation and extends, it correctly:
- Creates a child `-EXT` reservation linked to the new one
- Allows source override to `Direct` (current behavior)
The original (pre‑split) reservation is now closed at `move_date`, so it won't be the target of further extensions.

## 8. Out of scope

- `RoomSwapDialog` — untouched.
- Booking screenshot Split Stay flow — untouched.
- No emails, WhatsApp, or guest‑facing notifications.

## 9. Verification checklist

1. Quick Actions for a checked‑in guest shows two side‑by‑side buttons.
2. "Move Guest to New Room" opens the dialog with original details pre‑filled.
3. Move Date picker enforces min/max correctly; New Room dropdown updates after date selection.
4. Available rooms exclude current room, maintenance, blocked, and overlapping units.
5. After Confirm: original `check_out_date` shortened, `total_price` recalculated; new reservation exists with `parent_reservation_id` set, `is_split_reservation = true`, same `booking_reference` and `channex_booking_id`.
6. Channex sync queue shows entries for both rooms over the affected date range (verify via `channex_sync_queue` rows).
7. `audit_logs` row with `action = 'split_reservation'`.
8. Original guest does not reappear in Check‑In card.
9. Extending the new reservation works and tags the extension as Direct.

## Files

- New migration `supabase/migrations/<timestamp>_add_split_reservation_columns.sql`
- New `src/components/MoveGuestSplitDialog.tsx`
- Edit `src/components/ReservationQuickActions.tsx` — split the swap button row, mount new dialog
