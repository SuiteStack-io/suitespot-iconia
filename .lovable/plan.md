

## Fix & Enhancements for Connection Status

### Issue 1: "Last sync" shows Failed after successful manual sync
The `fetchLastSync` function only queries logs where `function_name = 'channex-daily-sync'`. The manual "Run Full Sync Now" button calls `channex-full-sync` instead, so successful manual syncs are never reflected. Fix: query for both `channex-daily-sync` and `channex-full-sync` using `.in('function_name', ['channex-daily-sync', 'channex-full-sync'])`.

### Issue 2: Add "Clear Queue" button
Add a "Clear Completed" button next to the existing "Refresh" button in the Sync Queue Status card. It will delete all rows from `channex_sync_queue` where `status = 'completed'`, then refresh stats. Use an AlertDialog for confirmation.

### Issue 3: Clickable queue stat cards with log details
Add state to track which status card is selected. When a card is clicked, fetch matching rows from `channex_sync_queue` and display them in a collapsible table below the cards showing: created_at, entity_type, entity_id, status, error_message. Clicking the same card again collapses it.

### Files to change
- `src/components/channex/ConnectionStatus.tsx`

