

## Fix "Full Sync (500 Days)" Button on Properties Tab

### Problem
The `fullSyncProperty` function in `PropertySync.tsx` calls the same `channex-full-sync` edge function as the Connection tab's "Run Full Sync Now" — so the underlying logic is identical. However, it does **not** call `fetchData()` after completion, unlike the `syncProperty` function which does. This means:
- The UI doesn't refresh after a full sync, making it look like nothing happened
- The "Last synced" timestamp and sync status don't update
- Users perceive the sync as having "failed"

### Fix
**File: `src/components/channex/PropertySync.tsx`**

Add `await fetchData()` after a successful full sync (and also after a failed one, to refresh state). This is a one-line addition in the `fullSyncProperty` function, mirroring what `syncProperty` already does.

Specifically, add `await fetchData();` after the full sync result dialog is shown (after `setShowFullSyncDialog(true)`) and also in the error path, before the `finally` block completes.

