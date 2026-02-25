
-- Fix rate_plans.property_id FK: drop the wrong one pointing to channex_mappings, add correct one to properties
ALTER TABLE public.rate_plans DROP CONSTRAINT IF EXISTS rate_plans_property_id_fkey;
ALTER TABLE public.rate_plans ADD CONSTRAINT rate_plans_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id);

-- Now backfill rate_plans
UPDATE public.rate_plans SET property_id = (SELECT id FROM public.properties WHERE is_default = true LIMIT 1) WHERE property_id IS NULL;

-- Create triggers (units and reservations columns + indexes were already created by the partial migration)
CREATE OR REPLACE FUNCTION public.set_default_property_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.property_id IS NULL THEN
    SELECT id INTO NEW.property_id FROM public.properties WHERE is_default = true LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_units_default_property ON public.units;
DROP TRIGGER IF EXISTS set_reservations_default_property ON public.reservations;
DROP TRIGGER IF EXISTS set_rate_plans_default_property ON public.rate_plans;

CREATE TRIGGER set_units_default_property BEFORE INSERT ON public.units
  FOR EACH ROW EXECUTE FUNCTION set_default_property_id();
CREATE TRIGGER set_reservations_default_property BEFORE INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION set_default_property_id();
CREATE TRIGGER set_rate_plans_default_property BEFORE INSERT ON public.rate_plans
  FOR EACH ROW EXECUTE FUNCTION set_default_property_id();
