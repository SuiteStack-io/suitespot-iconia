-- Add features column to units table for property amenities/features
ALTER TABLE units ADD COLUMN IF NOT EXISTS features TEXT[] DEFAULT '{}';

-- Add comment
COMMENT ON COLUMN units.features IS 'Array of property features and amenities for display in selection modal';