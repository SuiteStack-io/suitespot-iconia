CREATE TABLE public.summary_report_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL,
  property_id uuid REFERENCES public.properties(id),
  report_date date NOT NULL,
  recipients text[] DEFAULT '{}',
  pdf_url text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.summary_report_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view report logs" ON public.summary_report_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));