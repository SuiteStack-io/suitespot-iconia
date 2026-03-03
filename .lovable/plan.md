

## Quick Rate Editor: Bug Fixes and Drag-to-Fill Feature

### BUG 1: Rate Changes Apply Globally (Not Per-Date)

**Root cause**: The `rate_plan_prices` table stores ONE `weekday_rate` and ONE `weekend_rate` per rate plan — not per-date rates. When you edit a cell for Nov 21 and save, `syncNow()` updates the base `weekday_rate` on the `rate_plan_prices` row, which changes ALL weekday cells. The DB trigger then pushes to Channex without date context, so Channex applies it from today forward.

**Fix**: The grid's sync logic should push date-specific entries to the `channex_sync_queue` table directly (with explicit `date_from`/`date_to` from each pending change), instead of relying on the DB trigger which has no date awareness. The local `rate_plan_prices` row still gets updated (since that's the source of truth for the base rate), but the Channex push uses the exact dates from the pending changes.

In `syncNow()`:
- After updating `rate_plan_prices`, insert entries into `channex_sync_queue` with each change's specific date as both `date_from` and `date_to`
- Skip the automatic `channex-process-sync-queue` invocation from the trigger (already handled by the manual invoke at the end)

### BUG 2: Weekend Highlighting Includes Thursday

**Root cause**: Line 55 — `isWeekendDay` uses `isThursday || isFriday || isSaturday`. Thursday/Friday/Saturday are weekend **pricing** days, but visually only Friday and Saturday should be highlighted as weekends.

**Fix**: Split into two functions:
- `isWeekendRate(date)` — Thu/Fri/Sat — used for **rate calculation** (which rate to display/save)
- `isWeekendHighlight(date)` — Fri/Sat only — used for **visual highlighting** (pink/accent background)

### FEATURE: Drag-to-Fill

After editing a cell, the user can drag a handle to copy the value across adjacent cells in the same row.

**State additions**: `isDragging`, `dragStartCell`, `dragValue`, `draggedOverCells`

**Implementation**:
- Each non-editing cell gets `onMouseDown` (start drag from committed value), `onMouseEnter` (track hovered cells during drag), and a global `onMouseUp` (apply value to all dragged cells)
- Only horizontal drag within the same row is allowed
- Dragged-over cells show dashed blue border and the preview value
- On mouse-up, all dragged cells are added to `pendingChanges`
- Also support **Shift+Click** as an alternative: click cell A, edit value, press Enter, then Shift+Click cell D — fills A through D with the same value

**Keyboard shortcuts**:
- `Ctrl+Right` after editing: copy value to next cell
- `Ctrl+Shift+Right`: copy to all remaining cells in the row

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `src/components/pms/QuickRateGrid.tsx` | Fix sync to use per-date queue entries; split weekend logic; add drag-to-fill state and handlers |

### Summary of Changes in QuickRateGrid.tsx

1. Replace `isWeekendDay` with `isWeekendRate` (Thu/Fri/Sat for pricing) and `isWeekendHighlight` (Fri/Sat for visuals)
2. In `syncNow()`: after updating `rate_plan_prices`, also insert rows into `channex_sync_queue` with each change's exact `date`/`date` as `date_from`/`date_to`
3. Add drag state (`isDragging`, `dragValue`, `draggedCells`) and mouse event handlers on cells
4. Add drag handle UI element on the active/recently-edited cell
5. Add Shift+Click range fill support
6. Add `Ctrl+Right` / `Ctrl+Shift+Right` keyboard shortcuts

