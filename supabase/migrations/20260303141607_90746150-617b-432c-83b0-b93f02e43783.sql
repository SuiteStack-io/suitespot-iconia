CREATE TABLE public.rate_plan_date_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_plan_id uuid NOT NULL REFERENCES rate_plans(id) ON DELETE CASCADE,
  override_date date NOT NULL,
  rate numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (rate_plan_id, override_date)
);

ALTER TABLE public.rate_plan_date_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Property managers can manage date overrides"
  ON public.rate_plan_date_overrides FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rate_plans rp
      WHERE rp.id = rate_plan_id
      AND user_has_property_access(rp.property_id, 'manager')
    )
  );

CREATE POLICY "Public can view date overrides"
  ON public.rate_plan_date_overrides FOR SELECT
  USING (true);