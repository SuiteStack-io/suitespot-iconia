

## Add Clone Functionality to Bulk Edit Mode

### Current State
In bulk edit mode, the actions column shows nothing (line 1130: `} : !isBulkEdit ? (...) : null`). The existing clone logic uses a dialog with room number input and saves directly to the database.

### Plan

**Changes in `src/pages/Rooms.tsx`:**

1. **Add Clone & Delete buttons in bulk edit mode actions** (lines 1115-1130)
   - Replace the `null` for `isBulkEdit` with clone + delete icon buttons
   - Clone button calls the existing `handleCloneClick(unit)` which opens the clone dialog — this saves immediately to DB, which is fine since cloning creates a new record
   - Delete button calls `handleDeleteClick(unit)` — same as non-bulk-edit behavior

2. **Add "+ Add Unit" footer in bulk edit mode** (lines 1172-1181)
   - Currently the footer actions only show when `!isBulkEdit` — remove that condition so the "Add Unit" button is visible in both modes

This is a simple change — just expose the existing clone/delete actions during bulk edit mode. No new state, no new dialogs, no "Clone Multiple" modal needed for this iteration since the existing clone dialog already handles the workflow well.

### Files
- `src/pages/Rooms.tsx`: ~10 lines changed in the actions column and footer condition

