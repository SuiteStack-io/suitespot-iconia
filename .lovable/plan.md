

## Diagnose and Fix: Daily Reports Toggle Not Persisting

### What I verified
- DB columns exist correctly: `daily_summary_email` (default false) and `weekly_monthly_summary_email` (default false). ✅
- `types.ts` includes both columns. ✅
- The code in `NotificationSettingsSection.tsx` does spread both fields into the upsert payload via `...currentSettings` and `...settings`. ✅
- The DB shows three rows were freshly upserted today at 15:16:49–55, all with both summary fields set to `false` — so the upsert IS firing, the RLS IS allowing writes, but the values being written are `false` rather than the user's toggle state.

### Most likely root cause
The `useEffect` that mirrors `settings` into `settingsRef` and the `useEffect` that watches `triggerSave` both run **on the same React commit**. When `handleSave` in `EditPermissionsDialog` calls `setNotifSaveTrigger(prev => prev + 1)`, the `triggerSave` effect can fire before `settingsRef.current` is guaranteed to reflect the latest user toggle if any pending state hasn't flushed (e.g., toggling immediately before clicking Save). The current code reads from a ref instead of just using `settings` directly — there's no reason to use a ref here since the effect re-runs only on `triggerSave` change.

A second contributing issue: the `triggerSave` effect's dependency array is `[triggerSave]` (missing `userId`). If the dialog is reused for a different user without unmounting, this is fine today, but it's brittle.

### Fix

**File: `src/components/NotificationSettingsSection.tsx`**

1. **Remove the `settingsRef` indirection.** In the `triggerSave` effect, build the payload from `settings` directly (the effect captures the current closure value). Add `settings` and `userId` to the dependency array, but keep the `triggerSave > 0` guard so it only runs when the parent explicitly bumps the counter.

2. **Add diagnostic console logs** (temporary, will leave in for one verification round):
   - Log `[NotifSettings] fetched` with the row read from DB.
   - Log `[NotifSettings] toggling <key> -> <newValue>` in `handleToggle`.
   - Log `[NotifSettings] saving payload` immediately before the upsert (both in `saveSettings` and the `triggerSave` effect).
   - Log `[NotifSettings] save result` with `{ error, status }` after the upsert.

3. **Surface failures.** The `triggerSave` effect currently swallows errors silently from the user's perspective (toast fires but `EditPermissionsDialog` still shows a "Success" toast 500ms later). Change `EditPermissionsDialog.handleSave` to await the notification save explicitly instead of relying on `setTimeout(500)`.

**File: `src/components/EditPermissionsDialog.tsx`**

Replace the trigger-counter pattern with a direct imperative call:

- Lift the save action into `NotificationSettingsSection` exposed via a `ref` (using `useImperativeHandle`) OR simpler: keep the trigger-counter but `await` a Promise the child resolves. Cleanest path: convert `NotificationSettingsSection` to forward a `ref` exposing `{ save: () => Promise<void> }`. Then `handleSave` becomes:

```ts
if (!isAdmin) { /* upsert permissions */ }
await notifRef.current?.save();
toast({ title: 'Success', ... });
onOpenChange(false);
onSuccess?.();
```

This eliminates the 500ms race entirely and surfaces real save errors before the dialog closes.

### Verification steps after fix
1. Open Edit Permissions for a user, toggle Daily Reports ON, click Save.
2. Console should show: toggle → save payload → save result `{ error: null }`.
3. DB row for that user should have `daily_summary_email = true`.
4. Reopen the dialog; toggle should be ON.
5. Repeat for Weekly & Monthly Reports toggle.
6. Toggle both OFF, save, reopen — both should be OFF.

### Out of scope (unchanged)
- Toggle labels and descriptions
- Layout / two-column grid
- Other notification toggles (check-in, check-out, etc.)
- Edge Functions
- Database schema / RLS policies

