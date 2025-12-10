-- Add timestamp columns for check-in and check-out tracking
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS checked_in_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS checked_out_at timestamp with time zone;