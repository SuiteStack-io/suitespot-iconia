
-- Create channex_property_config table
CREATE TABLE public.channex_property_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_name text NOT NULL,
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT 'EG',
  zip_code text NOT NULL DEFAULT '',
  timezone text NOT NULL DEFAULT 'Africa/Cairo',
  currency text NOT NULL DEFAULT 'USD',
  latitude decimal,
  longitude decimal,
  description text,
  channex_property_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.channex_property_config ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can manage channex property config"
ON public.channex_property_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can read
CREATE POLICY "Authenticated users can view channex property config"
ON public.channex_property_config
FOR SELECT
USING (true);

-- Updated_at trigger
CREATE TRIGGER update_channex_property_config_updated_at
BEFORE UPDATE ON public.channex_property_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
