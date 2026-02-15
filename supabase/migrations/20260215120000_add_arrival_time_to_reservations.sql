-- Add arrival_time column to reservations table
-- Stores the expected arrival time in HH:MM format (24h), e.g. "14:00"
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS arrival_time text;
