
CREATE TABLE public.channex_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  message text NOT NULL,
  property_id uuid,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.channex_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage channex alerts"
  ON public.channex_alerts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert channex alerts"
  ON public.channex_alerts FOR INSERT
  WITH CHECK (true);
