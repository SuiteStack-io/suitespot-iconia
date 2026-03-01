
-- 1. Create companies table
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  default_currency text NOT NULL DEFAULT 'USD',
  default_timezone text NOT NULL DEFAULT 'Africa/Cairo',
  vat_rate numeric NOT NULL DEFAULT 14,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- RLS: admins can manage
CREATE POLICY "Admins can manage all companies"
  ON public.companies FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Add company_id columns
ALTER TABLE public.properties ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.profiles ADD COLUMN company_id uuid REFERENCES public.companies(id);

-- Now add the RLS policy that references profiles.company_id
CREATE POLICY "Users can view their company"
  ON public.companies FOR SELECT
  USING (
    id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

-- 3. Add property_id to secondary tables
ALTER TABLE public.whatsapp_message_log ADD COLUMN property_id uuid;
ALTER TABLE public.room_shuffle_log ADD COLUMN property_id uuid;
ALTER TABLE public.channel_markup_settings ADD COLUMN property_id uuid;
ALTER TABLE public.derived_rate_plan_mappings ADD COLUMN property_id uuid;

-- Triggers for auto-setting default property_id
CREATE TRIGGER set_whatsapp_message_log_property_id
  BEFORE INSERT ON public.whatsapp_message_log
  FOR EACH ROW EXECUTE FUNCTION set_default_property_id();

CREATE TRIGGER set_room_shuffle_log_property_id
  BEFORE INSERT ON public.room_shuffle_log
  FOR EACH ROW EXECUTE FUNCTION set_default_property_id();

CREATE TRIGGER set_channel_markup_settings_property_id
  BEFORE INSERT ON public.channel_markup_settings
  FOR EACH ROW EXECUTE FUNCTION set_default_property_id();

CREATE TRIGGER set_derived_rate_plan_mappings_property_id
  BEFORE INSERT ON public.derived_rate_plan_mappings
  FOR EACH ROW EXECUTE FUNCTION set_default_property_id();

-- 4. Seed default company and backfill
DO $$
DECLARE
  v_company_id uuid;
  v_default_property_id uuid;
BEGIN
  INSERT INTO public.companies (name, default_currency, default_timezone, vat_rate)
  VALUES ('SuiteSpot Hospitality', 'USD', 'Africa/Cairo', 14)
  RETURNING id INTO v_company_id;

  UPDATE public.properties SET company_id = v_company_id;
  UPDATE public.profiles SET company_id = v_company_id;

  SELECT id INTO v_default_property_id FROM public.properties WHERE is_default = true LIMIT 1;
  IF v_default_property_id IS NULL THEN
    SELECT id INTO v_default_property_id FROM public.properties LIMIT 1;
  END IF;

  IF v_default_property_id IS NOT NULL THEN
    UPDATE public.whatsapp_message_log SET property_id = v_default_property_id WHERE property_id IS NULL;
    UPDATE public.room_shuffle_log SET property_id = v_default_property_id WHERE property_id IS NULL;
    UPDATE public.channel_markup_settings SET property_id = v_default_property_id WHERE property_id IS NULL;
    UPDATE public.derived_rate_plan_mappings SET property_id = v_default_property_id WHERE property_id IS NULL;
  END IF;
END $$;
