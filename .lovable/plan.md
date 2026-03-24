

## Add "Clear Failed" button and status filter to Sync Queue

### Changes — Single file: `src/components/channex/ConnectionStatus.tsx`

**1. Add `clearFailedQueue` function** (after `clearCompletedQueue`, ~line 160)
- Same pattern as `clearCompletedQueue` but deletes where `status = 'failed'`
- Uses a separate `clearingFailed` state variable
- Resets `selectedQueueStatus` and `queueItems` if currently viewing failed items

**2. Add "Clear Failed" button with confirmation dialog** (after the existing "Clear Completed" AlertDialog, ~line 595)
- Red outlined button with Trash2 icon: "Clear Failed (N)"
- Disabled when `queueStats.failed === 0` or while clearing
- Confirmation dialog: "Clear all failed sync queue items? This cannot be undone."

**3. Add status filter dropdown** (above the queue items table, ~line 510)
- Add a Select dropdown with options: "All", "Pending", "Processing", "Failed", "Completed"
- When "All" is selected, fetch items without status filter (limit 50, ordered by created_at desc)
- Update `fetchQueueItems` to accept an optional status parameter — if "all", omit the `.eq('status', ...)` filter
- The status card click behavior remains, but the dropdown syncs with `selectedQueueStatus`

### What stays the same
- All sync logic untouched
- Existing "Clear Completed" button unchanged
- Queue card click behavior preserved
- No other files modified

