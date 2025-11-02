-- Add view column to units table
ALTER TABLE public.units 
ADD COLUMN view text;

-- Add a comment to document the column
COMMENT ON COLUMN public.units.view IS 'The view type of the unit (e.g., Main street, Courtyard)';