-- Remove unique constraint on name to allow multiple rooms with the same suite name
ALTER TABLE public.units DROP CONSTRAINT IF EXISTS units_name_key;

-- Ensure unit_number is unique (if not already)
-- First check if the constraint exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'units_unit_number_key' 
    AND conrelid = 'public.units'::regclass
  ) THEN
    ALTER TABLE public.units ADD CONSTRAINT units_unit_number_key UNIQUE (unit_number);
  END IF;
END $$;