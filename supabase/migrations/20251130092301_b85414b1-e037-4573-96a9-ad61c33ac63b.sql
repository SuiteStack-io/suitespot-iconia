
-- Drop the existing check constraint
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;

-- Add a new check constraint that allows confirmed, checked-in, checked-out, and cancelled statuses
ALTER TABLE reservations ADD CONSTRAINT reservations_status_check 
CHECK (status IN ('confirmed', 'checked-in', 'checked-out', 'cancelled', 'completed'));
