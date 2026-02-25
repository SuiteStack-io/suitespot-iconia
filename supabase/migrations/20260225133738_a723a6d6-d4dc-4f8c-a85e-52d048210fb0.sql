
-- Add property_id to units
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id);
CREATE INDEX IF NOT EXISTS idx_units_property_id ON public.units(property_id);

-- Add property_id to reservations
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id);
CREATE INDEX IF NOT EXISTS idx_reservations_property_id ON public.reservations(property_id);

-- Backfill existing rows
UPDATE public.units
  SET property_id = (SELECT id FROM public.properties WHERE is_default = true LIMIT 1)
  WHERE property_id IS NULL;

UPDATE public.reservations
  SET property_id = (SELECT id FROM public.properties WHERE is_default = true LIMIT 1)
  WHERE property_id IS NULL;

-- Recreate triggers
DROP TRIGGER IF EXISTS set_units_default_property ON public.units;
DROP TRIGGER IF EXISTS set_reservations_default_property ON public.reservations;

CREATE TRIGGER set_units_default_property BEFORE INSERT ON public.units
  FOR EACH ROW EXECUTE FUNCTION set_default_property_id();
CREATE TRIGGER set_reservations_default_property BEFORE INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION set_default_property_id();
