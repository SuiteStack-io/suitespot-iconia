-- Add photos column to units table to store image URLs
ALTER TABLE public.units 
ADD COLUMN photos text[] DEFAULT '{}'::text[];