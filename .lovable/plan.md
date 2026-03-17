

## Add Save Button for Admin Users in Permissions Modal

### Problem
The "Save Changes" button is conditionally hidden when the user being edited is an admin (`!isAdmin`). But admins still have editable sections: Property Access and Email Notifications. Currently there's no way to save notification changes for admin users — only a "Cancel" button is shown.

### Fix
In `src/components/EditPermissionsDialog.tsx`, change the footer to always show the "Save Changes" button. For admin users, it will save notification settings (via `triggerSave`). For non-admin users, it saves both permissions and notifications as it does now.

**Changes:**
1. Remove the `{!isAdmin && ...}` conditional around the Save button — always render it
2. Update `handleSave` to handle the admin case: skip the permissions upsert (not needed), but still trigger notification save and show success toast
3. Show a success toast: "Settings updated for [user name]"

Single file change: `src/components/EditPermissionsDialog.tsx` lines 166-203 and 316-327.

