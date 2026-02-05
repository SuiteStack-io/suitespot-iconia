-- Add Channex room type columns to units table
ALTER TABLE units 
  ADD COLUMN IF NOT EXISTS count_of_rooms integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS default_occupancy integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS room_kind text DEFAULT 'room',
  ADD COLUMN IF NOT EXISTS max_children integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_infants integer DEFAULT 0;

-- Add check constraint for room_kind values
ALTER TABLE units 
  ADD CONSTRAINT units_room_kind_check 
  CHECK (room_kind IN ('room', 'dorm'));