-- Add booking_com_name column to units table
ALTER TABLE units 
ADD COLUMN IF NOT EXISTS booking_com_name TEXT;