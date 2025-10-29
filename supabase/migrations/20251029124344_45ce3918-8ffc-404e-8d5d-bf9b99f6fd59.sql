-- Add price_per_night column to units table
ALTER TABLE public.units 
ADD COLUMN price_per_night numeric(10,2) DEFAULT NULL;