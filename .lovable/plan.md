# Manual Room Change Undo Queue

Adds an Undo flow to `src/pages/ShuffleHistory.tsx` (Manual tab only). All other behavior — Automatic tab, queries, sort order, property filter, manual logging from Prompt 3, DB triggers, and email functions — remains untouched.

## What the user will see

**On the Manual tab (admin only):**

- Each row gets an outline-sized **Undo** button (Undo2 icon) on the right of the header, next to the timestamp/badges, with a tooltip explaining it stages a reversal.
- Rows whose `reason` is `Manual mid-stay transfer` or `Manual drag-and-drop undone via toast` show the button **disabled** with an explanatory tooltip.
- Clicking Undo tints the row card (`bg-amber-50`), adds a small "Queued for undo" badge, and swaps the button to **Cancel** (X icon) which removes the row from the queue.
- A new **Save Changes (N)** primary button appears in the page header (right side of the Automatic/Manual toggle row, wraps below on mobile). It shows the queued count and is disabled when the queue is empty.

**On the Automatic tab:** no Undo buttons, no Save Changes button — identical to today.

**Non-admins:** rows on Manual tab render as today, no Undo buttons, no Save Changes button.

## Save Changes flow

1. Confirmation modal (AlertDialog): "Reverse N room changes?" with the body copy from the spec, Cancel | Confirm.
2. On Confirm, iterate each queued row sequentially. For each `move` in the row's `moves` array:
   - **Conflict check** against `reservations`: `.select('id, guest_names').eq('unit_id', move.from_unit_id).neq('id', move.reservation_id).lt('check_in_date', move.check_out_date).gt('check_out_date', move.check_in_date).is('cancelled_at', null)` — matches existing pattern in `AvailabilityCalendar.tsx:450`.
   - If conflict → push to `failed[]` with reason `"<guest>: Original room #<n> is now occupied by <other guest>"`.
   - Else `update reservations.unit_id = move.from_unit_id where id = move.reservation_id`. On error → `failed[]`. On success → `succeeded[]`.
3. For each row with ≥1 successful move, insert ONE new `room_shuffle_log` row with `change_type: 'manual'`, `reason: 'Manual undo from history page'`, `triggered_by_booking_id` and `triggered_by_reference` copied from the original row, and `moves` rebuilt with from/to swapped (only the successful moves), `move_count` = successful count. **`property_id` is omitted from the insert payload** — the existing BEFORE INSERT trigger fills it, matching the pattern used by Prompt 3's manual logging in the five frontend handlers.
4. Toast result:
   - All success → success toast "Reversed N room change(s)."
   - Partial → default toast with a **Details** action that opens a modal listing failures.
   - All fail → destructive toast + Details modal.
5. Clear `queuedUndos` and call `fetchLogs()` so the new "Manual undo from history page" rows appear immediately.

The DB trigger handles Channex sync. No `send-room-change-notification` invocation (per spec section 7).

## Technical details

**State added to `ShuffleHistory.tsx`:**
```ts
const [queuedUndos, setQueuedUndos] = useState<Set<string>>(new Set());
const [confirmOpen, setConfirmOpen] = useState(false);
const [executing, setExecuting] = useState(false);
const [failureDetails, setFailureDetails] = useState<{ row: string; reason: string }[] | null>(null);
const isAdmin = userRole === 'admin';
```

**ShuffleLog interface gets `triggered_by_booking_id: string | null`** so we can read it directly from each row.

**Undoability helper:**
```ts
const NON_UNDOABLE_REASONS: Record<string, string> = {
  'Manual mid-stay transfer': 'Mid-stay transfers cannot be undone here. Edit the reservation directly.',
  'Manual drag-and-drop undone via toast': 'This row is itself an undo and cannot be reversed.',
};
```

**Imports to add:** `Undo2`, `X` from `lucide-react`; existing `Button`, `Tooltip*`, `AlertDialog*`, `Dialog*` (for failure details), `useToast` from `@/hooks/use-toast`. `TooltipProvider` wraps the rows section.

**Row rendering changes** (inside `logs.map`):
- `const queued = queuedUndos.has(log.id)` and `const disabledReason = NON_UNDOABLE_REASONS[log.reason ?? '']`.
- Apply `bg-amber-50` to the `Card` className when `queued`.
- In the header right cluster, after the existing badges + timestamp, render (only when `filter === 'manual'` and `isAdmin`):
  - "Queued for undo" small badge when `queued`.
  - Undo/Cancel button wrapped in `Tooltip`, disabled when `disabledReason` is set.

**Header changes:**
- Wrap the Tabs + new Save Changes button in a flex container that allows wrapping on mobile.
- Save Changes button: `disabled={queuedUndos.size === 0 || executing}`, hidden when `filter !== 'manual'` or `!isAdmin`. Opens `confirmOpen`.

**`handleSaveChanges` skeleton:**
```ts
const queuedRows = logs.filter(l => queuedUndos.has(l.id));
const failures: { row: string; reason: string }[] = [];

for (const row of queuedRows) {
  const successfulMoves: any[] = [];
  for (const move of (row.moves as any[]) ?? []) {
    if (!move?.from_unit_id || !move?.reservation_id) continue;
    const { data: conflicts } = await supabase
      .from('reservations')
      .select('id, guest_names')
      .eq('unit_id', move.from_unit_id)
      .neq('id', move.reservation_id)
      .lt('check_in_date', move.check_out_date)
      .gt('check_out_date', move.check_in_date)
      .is('cancelled_at', null);
    if (conflicts && conflicts.length > 0) {
      failures.push({
        row: row.triggered_by_reference,
        reason: `${move.guest_name}: Original room #${move.from_unit_number} is now occupied by ${conflicts[0].guest_names?.[0] ?? 'another guest'}`,
      });
      continue;
    }
    const { error } = await supabase
      .from('reservations')
      .update({ unit_id: move.from_unit_id })
      .eq('id', move.reservation_id);
    if (error) {
      failures.push({ row: row.triggered_by_reference, reason: `${move.guest_name}: ${error.message}` });
      continue;
    }
    successfulMoves.push({
      reservation_id: move.reservation_id,
      guest_name: move.guest_name,
      from_unit_id: move.to_unit_id,
      from_unit_number: move.to_unit_number,
      to_unit_id: move.from_unit_id,
      to_unit_number: move.from_unit_number,
      check_in_date: move.check_in_date,
      check_out_date: move.check_out_date,
    });
  }
  if (successfulMoves.length > 0) {
    await supabase.from('room_shuffle_log').insert({
      triggered_by_booking_id: row.triggered_by_booking_id ?? row.moves?.[0]?.reservation_id ?? null,
      triggered_by_reference: row.triggered_by_reference,
      room_type: row.room_type,
      moves: successfulMoves,
      move_count: successfulMoves.length,
      reason: 'Manual undo from history page',
      change_type: 'manual',
      // property_id intentionally omitted — BEFORE INSERT trigger fills it
    });
  }
}
```

Then surface results, clear `queuedUndos`, refetch.

**Failure details modal:** simple `Dialog` opened from a toast action (and auto-opened on all-fail); lists `failures` as a `<ul>`.

## Files touched

- `src/pages/ShuffleHistory.tsx` — only file. No new components, no DB changes, no edge function changes.

## Out of scope (per spec)

- No changes to Automatic tab, Prompt 3 manual logging, DB triggers, edge functions, or `send-room-change-notification`.
- No persistence of `queuedUndos` (refresh clears it — intentional).
- No deduplication when two queued rows touch the same reservation.
