# Fix: Late Checkout fee fails with `valid_dates` check constraint

## Root cause confirmed

Queried Postgres directly:

```
CHECK ((check_out_date > check_in_date))
```

The `valid_dates` constraint on `public.reservations` is strict (`>`). When `useLateCheckout.applyLateCheckout` inserts a fee reservation with `check_in_date === check_out_date === checkoutDate` (intentional — it's a fee charge, not a stay), Postgres rejects the insert.

## Audit of other reservation writers

Verified no other path produces same-day rows that would be silently let through by relaxing the constraint:

- **CreateReservationDialog / ReservationDetail edit / extend** — UI uses date pickers and nights calculations; never produces same-day.
- **parse-reservation-screenshot** — passes parsed `checkOutDate` from screenshots; real bookings are never same-day.
- **channex-booking-webhook + sync-channex-to-reservations** — OTA bookings always have `arrival_date < departure_date`.
- **auto-shuffle-rooms / room swap / MoveGuestSplitDialog** — operate on existing valid date pairs; never collapse to same-day.
- **Late checkout fee row (useLateCheckout)** — the only intentional same-day writer. Currently broken.

No path is currently relying on the strict `>` rule as a data-quality safety net. Application logic is the gatekeeper everywhere else.

## Fix (Fix A only)

Single migration that drops and recreates the constraint to allow `>=`:

```sql
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS valid_dates;
ALTER TABLE public.reservations ADD CONSTRAINT valid_dates CHECK (check_out_date >= check_in_date);
```

This still blocks impossible past-checkout rows (`check_out_date < check_in_date`) and now permits the same-day fee row used by late checkout.

## What does NOT change

- `src/hooks/useLateCheckout.ts` — no code changes.
- `LateCheckoutDialog.tsx` — no code changes.
- BlockedDatesManager refactor, Channex sync, MoveGuestSplitDialog — untouched.
- Late checkout fee row keeps its same-day shape (intentional).

## Verification after migration

1. Apply Late Checkout with fee enabled → save succeeds, fee reservation row is created with `check_in_date === check_out_date`.
2. Try a manual reservation with `check_out_date < check_in_date` → still rejected by the constraint.
3. Existing reservations and OTA inflow continue to work (constraint is only loosened, not tightened).
