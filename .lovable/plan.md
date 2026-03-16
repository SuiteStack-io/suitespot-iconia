

## Enhance Pending Changes UI in BulkAvailabilityEditor

The editor already uses a two-step Apply→Save workflow. The main gaps vs the request are: no old→new value display, no "Discard All" button, and "Save Changes" uses a simple spinner instead of the progress bar.

### Changes in `src/components/pms/BulkAvailabilityEditor.tsx`

1. **Add `previousAvailability` to `PendingAvailability` interface** — capture `currentAvailability` when applying, so old→new can be shown.

2. **Update pending items display** to show:
   - Room Type name
   - Date range (from → to)
   - Field: "Availability"
   - Old value → New value (e.g., "3 → 1")
   - Remove button (already exists)

3. **Add "Discard All" button** next to "Save Changes" in the Pending Changes card header — `variant="outline"`, clears `pendingAvailability`.

4. **Wire "Save Changes" to use the progress bar** — replace the `isSaving` spinner with the existing `syncStatus`/`syncProgress`/`syncStep` state and `animateProgress` helper, so Save Changes shows the same stepped progress bar (Pushing availability 0-50%, rates 50-90%, finalizing 90-100%). On success: clear pending + toast. On error: keep pending, show red bar.

5. **Disable both "Save Changes" and "Discard All"** while syncing.

No edge function or sync logic changes.

