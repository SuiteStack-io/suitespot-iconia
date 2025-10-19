-- Add adults and children columns to reservations table
ALTER TABLE public.reservations 
ADD COLUMN adults integer DEFAULT 1,
ADD COLUMN children integer DEFAULT 0;

-- Update existing reservations to set default values if null
UPDATE public.reservations 
SET adults = 1, children = 0 
WHERE adults IS NULL OR children IS NULL;