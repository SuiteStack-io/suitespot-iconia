-- Add cancellation tracking columns to reservations table
ALTER TABLE reservations
ADD COLUMN cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN cancelled_by UUID;