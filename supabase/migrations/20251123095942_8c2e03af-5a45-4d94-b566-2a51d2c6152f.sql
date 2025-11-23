-- Add is_private column to units table
ALTER TABLE units ADD COLUMN is_private boolean DEFAULT false;

-- Create index for faster filtering
CREATE INDEX idx_units_is_private ON units(is_private);

-- Update existing properties with "Almaza" in name to be private
UPDATE units SET is_private = true WHERE name ILIKE '%Almaza%';

COMMENT ON COLUMN units.is_private IS 'When true, property is hidden from public website and only visible to admins';