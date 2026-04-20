

## Split Summary Reports Toggle Into Daily vs Weekly/Monthly

### 1. Database migration

Add a new column and backfill from the existing one:

```sql
ALTER TABLE public.user_notification_settings
  ADD COLUMN weekly_monthly_summary_email boolean NOT NULL DEFAULT false;

-- Preserve existing preferences
UPDATE public.user_notification_settings
  SET weekly_monthly_summary_email = true
  WHERE daily_summary_email = true;
```

The existing `daily_summary_email` column is kept untouched (still defaults to `false`).

### 2. UI — `src/components/NotificationSettingsSection.tsx`

- Extend `NotificationSettings` interface and `DEFAULT_SETTINGS` with `weekly_monthly_summary_email: false`.
- Replace the single `daily_summary_email` entry in `NOTIFICATION_LABELS` with two entries:
  - **`daily_summary_email`** — label: *"Daily Reports"*, description: *"Receive automated daily summary reports by email"*
  - **`weekly_monthly_summary_email`** — label: *"Weekly & Monthly Reports"*, description: *"Receive automated weekly and monthly summary reports by email (includes financial data)"*
- Update `fetchSettings` to read both columns (defaulting each to `false`).
- Update the upsert payload in both `saveSettings` and the `triggerSave` effect to include `weekly_monthly_summary_email`.
- Update `handleEnableAll` to set both toggles to `true` (remove the carve-out that preserved the old admin-controlled value) and `handleDisableAll` to set both to `false`, so Enable All / Disable All now cover all six toggles.
- Order in the two-column grid: keep pairs together — Check-in/Check-out, New Booking/Cancelled Booking, Room Shuffle/Daily Reports, Weekly & Monthly Reports (single trailing item on its own row, matching the current layout pattern).

No changes to `EditPermissionsDialog.tsx` — it consumes `NotificationSettingsSection` and will pick up the new toggle automatically.

### 3. Edge Functions

- **`supabase/functions/generate-daily-summary/index.ts`** — no change. Continues to filter by `daily_summary_email = true`.
- **`supabase/functions/generate-weekly-summary/index.ts`** — change `.eq("daily_summary_email", true)` → `.eq("weekly_monthly_summary_email", true)`.
- **`supabase/functions/generate-monthly-summary/index.ts`** — same change as weekly.

No changes to report content, schedules, templates, or sender addresses.

### 4. Out of scope (explicitly unchanged)

- Report HTML content, layout, and sender email.
- Cron schedules (daily 8 AM, weekly Thursdays, monthly last working day).
- Other notification toggles (check-in, check-out, new booking, cancelled, room shuffle).
- `EditPermissionsDialog.tsx`, `MyNotifications.tsx`, `PropertyAccessSection`.

### Files changed

1. **New migration** — adds `weekly_monthly_summary_email` column.
2. **Data update** — backfills `weekly_monthly_summary_email = true` where `daily_summary_email = true`.
3. **`src/components/NotificationSettingsSection.tsx`** — two toggles, updated Enable/Disable All, read/write both columns.
4. **`supabase/functions/generate-weekly-summary/index.ts`** — switch recipient filter column.
5. **`supabase/functions/generate-monthly-summary/index.ts`** — switch recipient filter column.

### Verification

After implementation:
- Edit Permissions modal shows two separate toggles with the correct labels and descriptions in the same two-column grid.
- Existing users who had summary reports enabled still receive all three (no silent opt-out).
- A user with only "Daily Reports" enabled receives the 8 AM daily summary but is excluded from Thursday's weekly and the monthly report.
- A user with only "Weekly & Monthly Reports" enabled receives Thursday + monthly but not the daily summary.

