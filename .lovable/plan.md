## Goal

Insert a row into `room_shuffle_log` with `change_type = 'manual'` after every successful **manual** room change in five frontend handlers (plus the toast-undo path on the calendar). The DB trigger handles Channex sync, the existing email path stays untouched, and a log-insert failure must never block the user-visible success.

The schema (Prompt 2) is in place: `change_type` defaults to `'automatic'`, the trigger `set_room_shuffle_log_property_id` auto-fills `property_id`, and `triggered_by_booking_id` is a FK to `reservations.id`.

## The handlers

| File | Handler | Reason string |
|---|---|---|
| `src/components/AvailabilityCalendar.tsx` | `handleDragEnd` (~L1024) | `Manual drag-and-drop on calendar` |
| `src/components/AvailabilityCalendar.tsx` | `handleUndoMove` (~L984) | `Manual drag-and-drop undone via toast` |
| `src/components/ReservationQuickActions.tsx` | `handleMoveReservation` (~L358) | `Manual move via quick actions` |
| `src/components/RoomSwapDialog.tsx` | `handleSwap` (~L96) | `Manual room swap` (one row, two `moves` entries) |
| `src/components/RoomTransferDialog.tsx` | `handleConfirmTransfer` (~L184) | `Manual mid-stay transfer` |
| `src/pages/ReservationDetail.tsx` | `handleSave` (~L600) — **only when `formData.unit_id !== reservation.unit_id`** | `Manual edit via reservation modal` |

## Standard payload (single-move case)

```ts
await supabase.from('room_shuffle_log').insert({
  triggered_by_booking_id: reservation.id,
  triggered_by_reference: reservation.booking_reference ?? reservation.id,
  room_type: oldUnit.booking_com_name ?? oldUnit.name ?? 'Unknown',
  moves: [{
    reservation_id: reservation.id,
    guest_name: reservation.guest_names?.[0] ?? 'Guest',
    from_unit_id: oldUnitId,
    from_unit_number: oldUnit.unit_number ?? '',
    to_unit_id: newUnitId,
    to_unit_number: newUnit.unit_number ?? '',
    check_in_date: reservation.check_in_date,
    check_out_date: reservation.check_out_date,
  }],
  move_count: 1,
  reason: '<per-handler reason>',
  change_type: 'manual',
});
```

`property_id` is omitted — the BEFORE INSERT trigger fills it. No new Supabase queries are needed; every handler already holds the unit objects in state (`units`, `availableUnits`, `unitAvailability`) or reads them from dialog props (`currentUnit`, `reservation.units`).

`room_type` on `room_shuffle_log` is a free-text label (the auto-shuffle function passes a name string here too). We use `booking_com_name ?? name` of the **old** unit, matching the human-readable label already shown to users.

## Per-handler details

### 1. `AvailabilityCalendar.tsx` — `handleDragEnd`
- After the existing `update({ unit_id: targetUnitId })` succeeds (~L1063) and before the email send, insert the log row.
- Look up `originalUnit` and `targetUnit` from the existing `units` state (already done at L1065–L1066).
- Reason: `Manual drag-and-drop on calendar`.
- Wrap the insert in try/catch and `console.error` on failure — never block the toast/undo flow.

### 2. `AvailabilityCalendar.tsx` — `handleUndoMove` (toast undo)
Extend the `lastMove` `useState` type at L246–L251 to include the extra fields needed at undo time without re-querying:

```ts
const [lastMove, setLastMove] = useState<{
  reservationId: string;
  originalUnitId: string;
  newUnitId: string;
  guestName: string;
  bookingReference: string | null;
  checkInDate: string;
  checkOutDate: string;
  timestamp: number;
} | null>(null);
```

If a separate `interface`/`type` alias for this state exists anywhere, update it too — but a `grep` shows the type is declared inline on the `useState` call and is not aliased, so only the inline type at L246 needs updating.

Populate the new fields in the `setLastMove(...)` call at L1098 inside `handleDragEnd` (capture from `reservation` and `targetUnitId` before the email send).

In `handleUndoMove`, after the successful `update({ unit_id: lastMove.originalUnitId })` at L1004, insert a log row with from/to reversed. Use the new `lastMove` fields directly:

```ts
const newUnit = units.find(u => u.id === lastMove.newUnitId);
const originalUnit = units.find(u => u.id === lastMove.originalUnitId);

const { error: logError } = await supabase.from('room_shuffle_log').insert({
  triggered_by_booking_id: lastMove.reservationId,
  triggered_by_reference: lastMove.bookingReference ?? lastMove.reservationId,
  room_type: originalUnit?.booking_com_name ?? originalUnit?.name ?? 'Unknown',
  moves: [{
    reservation_id: lastMove.reservationId,
    guest_name: lastMove.guestName,
    from_unit_id: lastMove.newUnitId,        // reversed
    from_unit_number: newUnit?.unit_number ?? '',
    to_unit_id: lastMove.originalUnitId,     // reversed
    to_unit_number: originalUnit?.unit_number ?? '',
    check_in_date: lastMove.checkInDate,
    check_out_date: lastMove.checkOutDate,
  }],
  move_count: 1,
  reason: 'Manual drag-and-drop undone via toast',
  change_type: 'manual',
});
if (logError) console.error('Failed to log manual room change:', logError);
```

Result: a drag + toast-undo writes two log rows (move, then undo) — intentional.

### 3. `ReservationQuickActions.tsx` — `handleMoveReservation`
- After the successful `update({ unit_id: selectedUnitId })` at L378 and before the email send, insert the log row.
- Use `currentUnit` (prop) for old unit details and `newUnit = availableUnits.find(u => u.id === selectedUnitId)` (already at L380) for the new one.
- Reason: `Manual move via quick actions`.

### 4. `RoomSwapDialog.tsx` — `handleSwap` (two moves, one row)
- After the successful `supabase.rpc('swap_reservation_rooms', ...)` at L110 and before the two notification sends, insert ONE log row with `move_count: 2`:

```ts
{
  triggered_by_booking_id: reservation.id,
  triggered_by_reference: reservation.booking_reference ?? reservation.id,
  room_type: currentUnit?.booking_com_name ?? currentUnit?.name ?? 'Unknown',
  moves: [
    { reservation_id: reservation.id,     guest_name: reservation.guest_names[0],     from_unit_id: reservation.unit_id,     from_unit_number: currentUnit?.unit_number ?? '',                from_unit_number_safe: '', to_unit_id: swapReservation.unit_id, to_unit_number: swapReservation.units?.unit_number ?? '',          check_in_date: reservation.check_in_date,     check_out_date: reservation.check_out_date },
    { reservation_id: swapReservation.id, guest_name: swapReservation.guest_names[0], from_unit_id: swapReservation.unit_id, from_unit_number: swapReservation.units?.unit_number ?? '',     to_unit_id: reservation.unit_id,     to_unit_number: currentUnit?.unit_number ?? '',                    check_in_date: swapReservation.check_in_date, check_out_date: swapReservation.check_out_date },
  ],
  move_count: 2,
  reason: 'Manual room swap',
  change_type: 'manual',
}
```

(Drop the bogus `from_unit_number_safe` key — it's a typo from this plan; the actual code uses only the documented `moves[]` shape.)

All unit info is already on `currentUnit` and `swapReservation.units` — no extra query.

### 5. `RoomTransferDialog.tsx` — `handleConfirmTransfer`
- The current insert at L218 doesn't return the new reservation id. Change it to `.insert({...}).select('id').single()` and capture the new id (e.g. `newSegmentId`). The existing `if (insertError) throw insertError` check stays.
- After the second insert succeeds, before the notification at L253, insert the log row:

```ts
{
  triggered_by_booking_id: reservation.id, // ORIGINAL reservation
  triggered_by_reference: reservation.booking_reference ?? reservation.id,
  room_type: reservation.units?.booking_com_name ?? reservation.units?.name ?? 'Unknown',
  moves: [{
    reservation_id: newSegmentId,
    guest_name: reservation.guest_names?.[0] ?? 'Guest',
    from_unit_id: reservation.unit_id,
    from_unit_number: reservation.units?.unit_number ?? '',
    to_unit_id: newUnitId,
    to_unit_number: newUnit?.unit_number ?? '',
    check_in_date: transferDateStr,        // the transfer day
    check_out_date: reservation.check_out_date,
  }],
  move_count: 1,
  reason: 'Manual mid-stay transfer',
  change_type: 'manual',
}
```

`newUnit` is already fetched at L194.

### 6. `ReservationDetail.tsx` — `handleSave`
- Capture `const oldUnitId = reservation?.unit_id;` and `const unitChanged = formData.unit_id !== oldUnitId;` BEFORE the update.
- After the existing `update({...})` at L632 succeeds (the `if (error)` branch at L660 returns first), and before the modification-notification send at L672, run the log insert **only if `unitChanged` is true**.
- Resolve old unit from `reservation.units` and new unit from the `units` state (`units.find(u => u.id === formData.unit_id)`).
- Reason: `Manual edit via reservation modal`.
- This handler does **not** currently send a `send-room-change-notification`; we are adding only the log insert.

## Insert-failure handling (every handler)

```ts
const { error: logError } = await supabase.from('room_shuffle_log').insert({ ...payload });
if (logError) console.error('Failed to log manual room change:', logError);
// continue — never block on log failure
```

No `throw`, no toast. The room move already succeeded.

## Out of scope (untouched)

- Edge functions `auto-shuffle-rooms`, `auto-assign-rooms` (already log with `change_type` defaulting to `'automatic'`).
- DB trigger `trg_handle_reservation_change` (Channex sync continues automatically).
- Edge function `send-room-change-notification` (emails continue as today).
- `MoveGuestSplitDialog.tsx` (writes to `audit_logs`, intentionally excluded).
- `ShuffleHistory.tsx` (UI changes come in Prompt 4).
- Pre-validation, conflict detection, and the in-memory toast-undo behavior on drag-and-drop (only ADDING a log call when undo fires).
- No new database columns, no schema changes, no RLS edits.

## Verification

After the edits, manually exercise each path on the preview and confirm a `room_shuffle_log` row appears with `change_type = 'manual'` and the matching `reason`. The drag + toast-undo path should produce exactly two rows.
