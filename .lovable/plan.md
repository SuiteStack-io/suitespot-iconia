

## Verify & Update Notification Settings for Summary Reports

### Current State
- `user_notification_settings` table **exists** with `daily_summary_email` column (boolean, default `true`)
- No rows exist yet in the table
- The `NotificationSettingsSection` component labels it "Daily Summary" with description "Receive a daily summary email with occupancy and arrivals"
- The `DEFAULT_SETTINGS` in code defaults `daily_summary_email` to `true`

### Changes Required

**1. Database Migration — Change column default to `false`**
```sql
ALTER TABLE user_notification_settings 
  ALTER COLUMN daily_summary_email SET DEFAULT false;

UPDATE user_notification_settings SET daily_summary_email = false;
```

**2. Update `NotificationSettingsSection.tsx`**
- Change `DEFAULT_SETTINGS.daily_summary_email` from `true` to `false`
- Change `NOTIFICATION_LABELS.daily_summary_email`:
  - Label: `"Summary Reports (Daily, Weekly, Monthly)"`
  - Description: `"Receive automated daily, weekly, and monthly summary reports by email"`
- Update `fetchSettings` fallback to use `false` for `daily_summary_email`
- Update `handleEnableAll` / `handleDisableAll` to keep `daily_summary_email` at its current value (don't bulk-toggle it with the others, since it's admin-controlled)

**3. No edge function changes yet** — the summary edge functions don't exist yet. When they are created, they will query `user_notification_settings WHERE daily_summary_email = true` and check for valid email. This plan just prepares the toggle.

### Files Modified
| File | Change |
|------|--------|
| Migration SQL | Change default to `false`, update existing rows |
| `src/components/NotificationSettingsSection.tsx` | Rename label, update default, adjust description |

