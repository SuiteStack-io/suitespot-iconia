-- Add location column to units table
ALTER TABLE units ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'ICONIA';

-- Add check constraint for valid locations
ALTER TABLE units ADD CONSTRAINT units_location_check 
  CHECK (location IN ('ICONIA', 'Almaza Bay', 'North Coast'));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_units_location ON units(location);

-- Update existing Almaza Bay properties (502-509, Phase 1)
UPDATE units 
SET location = 'Almaza Bay' 
WHERE unit_number IN ('502', '504', '505', '506', '509', 'Phase 1')
  OR name ILIKE '%almaza%';

-- Update existing ICONIA properties (301-308)
UPDATE units 
SET location = 'ICONIA' 
WHERE unit_number IN ('301', '302', '303', '304', '305', '306', '307', '308')
  OR name ILIKE '%iconia%';