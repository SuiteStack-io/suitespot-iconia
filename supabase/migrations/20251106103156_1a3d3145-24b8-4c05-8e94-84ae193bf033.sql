-- Add unit_id to blocked_dates to allow blocking specific units
ALTER TABLE public.blocked_dates
ADD COLUMN unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE;

-- Drop the old unique constraint on blocked_date only
ALTER TABLE public.blocked_dates
DROP CONSTRAINT IF EXISTS blocked_dates_blocked_date_key;

-- Add new unique constraint on (blocked_date, unit_id)
-- This allows the same date to be blocked for different units
ALTER TABLE public.blocked_dates
ADD CONSTRAINT blocked_dates_date_unit_unique UNIQUE (blocked_date, unit_id);

-- Create index for faster lookups by unit
CREATE INDEX idx_blocked_dates_unit_id ON public.blocked_dates(unit_id);

-- Update the comment
COMMENT ON COLUMN public.blocked_dates.unit_id IS 'If NULL, blocks all units. If set, blocks only this specific unit.';