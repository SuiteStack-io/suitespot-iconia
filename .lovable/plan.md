## Goal

Fix the "Move Guest to New Room" failure. The split-reservation insert violates `idx_reservations_channex_booking_id` because it copies `channex_booking_id` from the parent OTA reservation, but that column has a UNIQUE index — only one PMS row can ever hold a given Channex booking ID.

## Root cause confirmed

`src/components/MoveGuestSplitDialog.tsx` line 349 inside the `insertPayload` object:

```ts
channex_booking_id: fullReservation.channex_booking_id,
```

When the original reservation is an OTA booking (Booking.com etc.), this field is non-null, so the insert collides with the parent row's existing value on the unique index.

## Change

Single edit, single file.

**`src/components/MoveGuestSplitDialog.tsx`** — `handleConfirm` → `insertPayload` (lines 323–354):

- Remove the `channex_booking_id: fullReservation.channex_booking_id,` line entirely so the new split row defaults to `NULL`.
- Add a short comment explaining why it's omitted (so a future contributor doesn't re-add it).
- Keep `booking_reference: fullReservation.booking_reference` unchanged — that column is not unique-constrained and is needed for display/linking.
- Every other field in the payload (status, source, channel, group_id, parent_reservation_id, is_split_reservation, pricing, etc.) stays untouched.

That's it.

## Out of scope / unchanged

- The unique index `idx_reservations_channex_booking_id` (correct as-is).
- The original reservation row — its `channex_booking_id` is not modified.
- Any other component, dialog, or insert path.
- Channex sync logic — the new split row simply isn't reported back to the OTA, which is the intended behaviour for an internal room move.

## Acceptance criteria

1. Move Guest to New Room on an OTA reservation (with non-null `channex_booking_id`) → insert succeeds, no unique-constraint error.
2. Move Guest to New Room on a direct/manual reservation (null `channex_booking_id`) → still works.
3. Original reservation keeps its `channex_booking_id` and continues to sync via Channex.
4. New split row has `channex_booking_id = NULL` and `parent_reservation_id` pointing at the original.
