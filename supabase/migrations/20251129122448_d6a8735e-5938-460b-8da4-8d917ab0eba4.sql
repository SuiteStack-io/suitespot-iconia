-- Create housekeeping_logs table to track cleaning actions
CREATE TABLE public.housekeeping_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  cleaned_by UUID REFERENCES public.profiles(id),
  cleaning_started_at TIMESTAMP WITH TIME ZONE,
  cleaning_completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  actual_duration_minutes INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN cleaning_started_at IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (cleaning_completed_at - cleaning_started_at)) / 60
      ELSE NULL
    END
  ) STORED,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add estimated cleaning time to units table
ALTER TABLE public.units 
ADD COLUMN IF NOT EXISTS estimated_cleaning_minutes INTEGER DEFAULT 45;

-- Enable RLS on housekeeping_logs
ALTER TABLE public.housekeeping_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view housekeeping logs
CREATE POLICY "Authenticated users can view housekeeping logs"
ON public.housekeeping_logs
FOR SELECT
TO authenticated
USING (true);

-- Policy: Authenticated users can insert housekeeping logs
CREATE POLICY "Authenticated users can insert housekeeping logs"
ON public.housekeeping_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Admins can manage all housekeeping logs
CREATE POLICY "Admins can manage all housekeeping logs"
ON public.housekeeping_logs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_housekeeping_logs_unit_id ON public.housekeeping_logs(unit_id);
CREATE INDEX idx_housekeeping_logs_cleaned_by ON public.housekeeping_logs(cleaned_by);
CREATE INDEX idx_housekeeping_logs_completed_at ON public.housekeeping_logs(cleaning_completed_at DESC);

-- Update existing units with estimated cleaning times based on size
UPDATE public.units
SET estimated_cleaning_minutes = CASE
  WHEN beds >= 3 THEN 60  -- Larger units take longer
  WHEN beds = 2 THEN 45   -- Standard 2-bedroom
  ELSE 30                  -- Studios and 1-bedroom
END
WHERE estimated_cleaning_minutes = 45;