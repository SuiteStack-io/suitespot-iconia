

## Fix: Move Cancel/Save buttons to the right in edit mode

The Cancel and Save Changes buttons are currently rendered **outside** the `flex justify-between` header container (line 1077 closes it, but the edit-mode buttons are at line 1131). This causes them to appear on the left below the header.

**Fix**: Move the `{isEditMode && ...}` block (lines 1131-1143) **inside** the `justify-between` container, right after the `{canEdit && !isEditMode && ...}` desktop block (after line 1076, before line 1077). This places them on the right side of the header, aligned with where the action buttons normally sit.

No other changes needed.

