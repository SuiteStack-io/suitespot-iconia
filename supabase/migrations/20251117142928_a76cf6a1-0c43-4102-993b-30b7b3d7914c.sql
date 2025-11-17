-- Add preferred_language column to reservations table
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS preferred_language text;