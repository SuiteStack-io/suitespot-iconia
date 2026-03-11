

## Add Notification Preferences System

### Overview
Create a `user_notification_settings` table and integrate it into the permissions UI and all email-sending edge functions. Users without settings rows default to all-enabled.

### 1. Database Migration

Create `user_notification_settings` table:
```sql
CREATE TABLE user_notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_email boolean NOT NULL DEFAULT true,
  checkout_email boolean NOT NULL DEFAULT true,
  new_booking_email boolean NOT NULL DEFAULT true,
  cancelled_booking_email boolean NOT NULL DEFAULT true,
  room_shuffle_email boolean NOT NULL DEFAULT true,
  daily_summary_email boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_notification_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage all settings
CREATE POLICY "Admins can manage all notification settings"
  ON user_notification_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view and update their own settings
CREATE POLICY "Users can view own notification settings"
  ON user_notification_settings FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notification settings"
  ON user_notification_settings FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own notification settings"
  ON user_notification_settings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
```

### 2. UI: Add Notification Toggles to EditPermissionsDialog

**File:** `src/components/EditPermissionsDialog.tsx`

Add a new "Email Notifications" section below the PropertyAccessSection. It will:
- Fetch `user_notification_settings` for the selected user (or show all-enabled defaults if no row exists)
- Show 6 toggles: checkin_email, checkout_email, new_booking_email, cancelled_booking_email, room_shuffle_email, daily_summary_email
- Include "Enable All" / "Disable All" buttons
- Save via upsert on the existing Save button click (alongside permissions)

### 3. UI: "My Notifications" Page

**New file:** `src/pages/MyNotifications.tsx`

A simple page accessible to all authenticated users showing the same 6 toggles for their own settings. Add a route `/admin/my-notifications` in App.tsx behind ProtectedRoute. Add a "My Notifications" link in the SlideMenu under the user's profile area or as a new nav item.

### 4. Update Edge Functions (5 functions)

Each function already fetches admin/staff users, then loops to send emails. Add a query to `user_notification_settings` and filter recipients. The pattern for each:

```typescript
// After fetching admin user list, before sending emails:
const { data: notifSettings } = await supabase
  .from('user_notification_settings')
  .select('user_id, checkin_email')  // use appropriate column
  .in('user_id', userIds);

// Filter: keep user if no settings row (default=enabled) or column is true
const filteredAdmins = admins.filter(admin => {
  const settings = notifSettings?.find(s => s.user_id === admin.user_id);
  if (!settings) return true; // no row = all enabled
  return settings.checkin_email; // check appropriate column
});
```

Functions to update and their setting columns:

| Function | Column |
|---|---|
| `send-checkin-notification` | `checkin_email` |
| `send-checkout-notification` | `checkout_email` |
| `send-reservation-notification` | `new_booking_email` |
| `send-cancellation-notification` | `cancelled_booking_email` |
| `auto-shuffle-rooms` | `room_shuffle_email` |

Log skipped users: `console.log("Skipped [email] — notifications disabled")`

### 5. Files Changed Summary

- **Migration**: 1 new table with RLS
- **EditPermissionsDialog.tsx**: Add notification toggles section
- **New page**: `src/pages/MyNotifications.tsx`
- **App.tsx**: Add route
- **SlideMenu.tsx**: Add "My Notifications" nav item
- **5 edge functions**: Add notification preference filtering

