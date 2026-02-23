
-- Create channel_markup_settings table
CREATE TABLE public.channel_markup_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name text NOT NULL,
  channel_id text,
  markup_percentage numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_markup_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage channel markup settings"
  ON public.channel_markup_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view channel markup settings"
  ON public.channel_markup_settings FOR SELECT
  USING (true);

CREATE TRIGGER update_channel_markup_settings_updated_at
  BEFORE UPDATE ON public.channel_markup_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create derived_rate_plan_mappings table
CREATE TABLE public.derived_rate_plan_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_rate_plan_id uuid NOT NULL REFERENCES public.rate_plans(id) ON DELETE CASCADE,
  channel_markup_id uuid NOT NULL REFERENCES public.channel_markup_settings(id) ON DELETE CASCADE,
  channex_base_rate_plan_id text NOT NULL,
  channex_derived_rate_plan_id text NOT NULL,
  channel_name text NOT NULL,
  markup_percentage numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.derived_rate_plan_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage derived rate plan mappings"
  ON public.derived_rate_plan_mappings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view derived rate plan mappings"
  ON public.derived_rate_plan_mappings FOR SELECT
  USING (true);

CREATE TRIGGER update_derived_rate_plan_mappings_updated_at
  BEFORE UPDATE ON public.derived_rate_plan_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
