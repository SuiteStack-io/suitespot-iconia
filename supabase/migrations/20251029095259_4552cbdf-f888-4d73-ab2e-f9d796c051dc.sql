-- Add room details columns to units table
ALTER TABLE public.units
ADD COLUMN IF NOT EXISTS beds integer,
ADD COLUMN IF NOT EXISTS baths integer,
ADD COLUMN IF NOT EXISTS max_guests integer,
ADD COLUMN IF NOT EXISTS sofa_bed boolean DEFAULT false;