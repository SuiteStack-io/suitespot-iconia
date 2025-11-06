-- Create blocked_dates table for manual date blocking
CREATE TABLE public.blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocked_date date NOT NULL UNIQUE,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view blocked dates (needed for public booking widget)
CREATE POLICY "Anyone can view blocked dates"
ON public.blocked_dates
FOR SELECT
USING (true);

-- Only admins can insert blocked dates
CREATE POLICY "Admins can insert blocked dates"
ON public.blocked_dates
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update blocked dates
CREATE POLICY "Admins can update blocked dates"
ON public.blocked_dates
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete blocked dates
CREATE POLICY "Admins can delete blocked dates"
ON public.blocked_dates
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster date lookups
CREATE INDEX idx_blocked_dates_date ON public.blocked_dates(blocked_date);