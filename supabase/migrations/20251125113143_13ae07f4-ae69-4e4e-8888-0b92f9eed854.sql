-- Add group_id column to reservations table for multi-room bookings
ALTER TABLE reservations ADD COLUMN group_id UUID;

-- Add index for better query performance on grouped reservations
CREATE INDEX idx_reservations_group_id ON reservations(group_id) WHERE group_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN reservations.group_id IS 'Links multiple reservations booked together. NULL for single-room bookings.';