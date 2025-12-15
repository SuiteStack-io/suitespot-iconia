-- Add weekend_rate column to units table
ALTER TABLE public.units ADD COLUMN weekend_rate numeric DEFAULT NULL;