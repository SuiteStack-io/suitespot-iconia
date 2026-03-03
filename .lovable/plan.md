

## Add Date Range to Bulk Edit & Remove Auto-Sync

### Changes in `src/components/pms/QuickRateGrid.tsx`

**1. Add date range state to Bulk Edit dialog**
- Add `bulkDateFrom` and `bulkDateTo` state (Date | undefined)
- Replace the current "all visible dates" behavior: instead of iterating over `days` (visible week), iterate over every date in the selected range
- Add two date pickers (From / To) to the Bulk Edit dialog, similar to the ones in RatePlanDialog
- Update the summary text to reflect the date range count

**2. Update `applyBulkEdit()` logic**
- Generate dates from `bulkDateFrom` to `bulkDateTo` using `addDays` loop
- For each date in range, create pending changes as before
- Require both dates to be set before allowing apply

**3. Remove auto-sync countdown**
- Remove `SYNC_DELAY`, `countdown` state, `countdownRef`, `startCountdown()` function
- Remove the `useEffect` that auto-syncs when countdown reaches 0
- Remove countdown badges/text from toolbar and pending panel
- Remove `Ctrl+S` handler
- Keep the manual "Sync Now" button and "Clear All" in the pending panel
- Remove `startCountdown()` calls from `commitCell`, drag-to-fill, bulk edit, and shift+click

**4. Replace "Sync Now" with "Save Changes"**
- Rename the button label from "Sync Now" to "Save Changes"
- Keep `syncNow()` as the handler (no preview modal per declined plan — just direct save on click)

### Single file change: `src/components/pms/QuickRateGrid.tsx`

