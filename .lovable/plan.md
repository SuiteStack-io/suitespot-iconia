

## Remove Misleading Channex Sync Toast from Room Rates

### Change

In `src/pages/RoomRates.tsx`, line 191, remove the toast that says "Syncing rates to Channex in the background…" since this page only saves to the database and does not trigger any Channex sync.

### File: `src/pages/RoomRates.tsx`
- Delete line 191: `toast.info('Syncing rates to Channex in the background…');`

