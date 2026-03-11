
CREATE TABLE public.user_notification_settings (
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

ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all notification settings"
  ON public.user_notification_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own notification settings"
  ON public.user_notification_settings FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notification settings"
  ON public.user_notification_settings FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own notification settings"
  ON public.user_notification_settings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
