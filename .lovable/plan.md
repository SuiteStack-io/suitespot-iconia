

## Fix Restrictions End-to-End Flow

Two bugs prevent the Bulk Editor -> Calendar flow from working correctly.

### Bug 1: Stop Sell / CTA / CTD default to OFF even when enabled

**Problem**: The Bulk Editor has a two-step UX for boolean restrictions: first check a checkbox to enable the field, then toggle a Switch to set the value. But the Switch defaults to `false`, so checking "Stop Sell" and clicking "Apply" saves `stop_sell: false`.

**Fix in `src/components/pms/BulkRestrictionEditor.tsx`**:
- When the user checks the "Stop Sell" checkbox, automatically set `stopSell` to `true` (same for CTA and CTD).
- Change the `onCheckedChange` handlers:
  ```
  setEnableStopSell(true); setStopSell(true);
  ```
  When unchecked, reset to false:
  ```
  setEnableStopSell(false); setStopSell(false);
  ```
- Same pattern for `closedToArrival` and `closedToDeparture`.

### Bug 2: Date range off-by-one

**Problem**: The Bulk Editor saves `date_to` as the exact selected date (e.g., "2026-03-05"). The calendar uses `r.date_to > dateStr` (exclusive), so the last day never shows. The calendar cell edit dialog correctly uses exclusive end dates (saves `date_to` as the next day), but the Bulk Editor does not.

**Fix in `src/components/pms/BulkRestrictionEditor.tsx`**:
- When building the insert rows, compute `date_to` as one day after the selected end date to match the exclusive convention:
  ```typescript
  date_to: format(addDays(dateTo!, 1), 'yyyy-MM-dd'),
  ```
- Import `addDays` from `date-fns` (already available).

### Files Changed

| File | Change |
|------|--------|
| `src/components/pms/BulkRestrictionEditor.tsx` | Auto-set boolean values to `true` on checkbox enable; fix `date_to` to be exclusive (day after selected end) |
