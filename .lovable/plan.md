

## Fix: Re-save truncated file ending

The build error is "Unexpected eof" at line 2185 in `CreateReservationDialog.tsx`. The screenshot shows the file was truncated mid-tag (`</D` instead of `</DialogContent>`). The file content currently reads as complete (2188 lines with proper closing), but the on-disk version may be corrupted from the previous edit.

**Fix**: Re-write the last few lines of the file to force a clean save and clear the build error. No logic changes needed — just touch the file ending.

