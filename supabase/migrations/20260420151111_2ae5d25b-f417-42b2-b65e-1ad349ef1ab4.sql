ALTER TABLE public.user_notification_settings
  ADD COLUMN IF NOT EXISTS weekly_monthly_summary_email boolean NOT NULL DEFAULT false;

UPDATE public.user_notification_settings
  SET weekly_monthly_summary_email = true
  WHERE daily_summary_email = true;