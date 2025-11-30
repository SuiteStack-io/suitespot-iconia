-- Add housekeeping_notes column to reservations table for inline editing
ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS housekeeping_notes TEXT;