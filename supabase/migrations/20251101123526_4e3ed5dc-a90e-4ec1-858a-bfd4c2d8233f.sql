-- Add tax_percentage column to units table
ALTER TABLE public.units 
ADD COLUMN tax_percentage numeric DEFAULT 14.00;

COMMENT ON COLUMN public.units.tax_percentage IS 'Tax percentage applied to this unit (e.g., 14 for 14%)';