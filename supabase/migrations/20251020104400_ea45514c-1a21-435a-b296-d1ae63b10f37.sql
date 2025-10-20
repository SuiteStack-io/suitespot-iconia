-- Add id_passport_url column to reservations table
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS id_passport_url text;