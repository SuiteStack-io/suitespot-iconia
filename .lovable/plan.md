

## Fix: Notification Settings Not Saving (Stale Closure Bug)

### Root Cause

In `NotificationSettingsSection.tsx`, the `useEffect` that watches `triggerSave` (line 86-90) only lists `[triggerSave]` in its dependency array. The `saveSettings` function it calls closes over the `settings` state variable. Since `settings` is not in the dependency array, the effect captures the version of `saveSettings` from the initial mount — which references the *original* fetched settings, not the user's toggled values.

When the parent (`EditPermissionsDialog`) increments `triggerSave`, the effect fires but writes back the stale initial values, effectively reverting any changes the user made.

### Fix

**File: `src/components/NotificationSettingsSection.tsx`**

1. Add `useRef` to the import (line 1)
2. Add a ref that always tracks the latest settings value:
   ```ts
   const settingsRef = useRef(settings);
   useEffect(() => { settingsRef.current = settings; }, [settings]);
   ```
3. Change the `triggerSave` effect (lines 86-90) to read from the ref instead of the closure:
   ```ts
   useEffect(() => {
     if (triggerSave && triggerSave > 0) {
       // Use ref to avoid stale closure
       const currentSettings = settingsRef.current;
       // inline the save using currentSettings
       (async () => {
         try {
           const { error } = await supabase
             .from('user_notification_settings')
             .upsert({
               user_id: userId,
               ...currentSettings,
               updated_at: new Date().toISOString(),
             }, { onConflict: 'user_id' });
           if (error) throw error;
         } catch (error) {
           console.error('Error saving notification settings:', error);
           toast({ title: 'Error', description: 'Failed to save notification settings', variant: 'destructive' });
         }
       })();
     }
   }, [triggerSave]);
   ```

This ensures the save always uses the latest toggle states, regardless of when the effect fires.

### No other changes needed
- Modal layout, permissions logic, and property access logic remain untouched
- The `standalone` save path (MyNotifications page) is unaffected — it calls `saveSettings` directly from a click handler, which always has current state

