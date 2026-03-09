ALTER TABLE public.units DROP CONSTRAINT IF EXISTS units_unit_number_key;
CREATE UNIQUE INDEX units_unit_number_property_key ON public.units (property_id, unit_number) WHERE unit_number IS NOT NULL;