

## Fix: Daily Summary Email Not Received

### Root Cause

The `user_notification_settings` table is **empty** — your preferences were never saved to the database. The report log confirms: both March 17 and March 18 runs logged "No recipients configured" and skipped sending.

**Why settings aren't saving:** In `EditPermissionsDialog.tsx`, the `handleSave` function triggers `setNotifSaveTrigger(prev => prev + 1)` and then **immediately** closes the dialog with `onOpenChange(false)`. React batches the state update, so the `NotificationSettingsSection` component unmounts before its `useEffect` on `triggerSave` fires — the `saveSettings()` call never executes.

### Fix

**File: `src/components/EditPermissionsDialog.tsx`** (lines 186-194)

Change `handleSave` to **await** the notification save before closing the dialog. Instead of using the trigger pattern, directly call the save and only close after it completes:

1. Add a `ref` to expose a `save()` method from `NotificationSettingsSection`, OR simpler: move the dialog close into a callback that fires after the notification save completes.

**Simplest approach:** Keep the trigger pattern but delay closing the dialog. Replace lines 186-194:
```typescript
// Trigger notification settings save for all users
setNotifSaveTrigger(prev => prev + 1);

// Delay close to allow the notification save useEffect to fire
setTimeout(() => {
  toast({
    title: 'Success',
    description: `Settings updated for ${user.full_name || user.email}`,
  });
  onOpenChange(false);
  onSuccess?.();
}, 500);
```

This gives the `NotificationSettingsSection` component time to execute its `saveSettings()` before the dialog unmounts.

### Files Changed
- `src/components/EditPermissionsDialog.tsx` — delay dialog close until after notification settings persist

