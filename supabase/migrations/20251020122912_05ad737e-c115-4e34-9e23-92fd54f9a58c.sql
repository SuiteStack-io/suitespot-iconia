-- Remove the restrictive source check constraint to allow dynamic user names and "Others" format
ALTER TABLE public.reservations 
DROP CONSTRAINT IF EXISTS reservations_source_check;