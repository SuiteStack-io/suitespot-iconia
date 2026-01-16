-- Create table for storing multiple passport images per reservation
CREATE TABLE public.reservation_passports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL,
  passport_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reservation_passports ENABLE ROW LEVEL SECURITY;

-- Policies: Allow authenticated users to manage passports
CREATE POLICY "Authenticated users can view passports"
  ON public.reservation_passports FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert passports"
  ON public.reservation_passports FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete passports"
  ON public.reservation_passports FOR DELETE
  USING (auth.uid() IS NOT NULL);