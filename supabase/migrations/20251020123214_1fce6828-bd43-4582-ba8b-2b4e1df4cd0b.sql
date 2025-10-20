-- Add guest_types column to store whether each guest is an adult or child
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS guest_types text[] DEFAULT '{}'::text[];