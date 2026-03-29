

## Remove "Create App Account" Button from Reservation Details

### Change
**File**: `src/pages/ReservationDetail.tsx`

1. Remove the import of `CreateGuestAccountDialog` (line 34)
2. Remove the two `<CreateGuestAccountDialog>` instances in the header action bar (around lines 1073-1076 and 1152-1155)
3. Remove the `CreateGuestAccountDialog` import if unused elsewhere in the file

Three deletions, no other changes.

