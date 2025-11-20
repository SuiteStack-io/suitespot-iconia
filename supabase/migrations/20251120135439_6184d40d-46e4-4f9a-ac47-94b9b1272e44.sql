-- Create stay surveys table for post-checkout feedback
CREATE TABLE public.stay_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  cleanliness_rating INTEGER CHECK (cleanliness_rating >= 1 AND cleanliness_rating <= 5),
  amenities_rating INTEGER CHECK (amenities_rating >= 1 AND amenities_rating <= 5),
  location_rating INTEGER CHECK (location_rating >= 1 AND location_rating <= 5),
  value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 5),
  would_recommend BOOLEAN,
  feedback TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add survey tracking to reservations
ALTER TABLE public.reservations
ADD COLUMN survey_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN survey_completed_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS
ALTER TABLE public.stay_surveys ENABLE ROW LEVEL SECURITY;

-- Admins can view all surveys
CREATE POLICY "Admins can view all stay surveys"
ON public.stay_surveys
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert surveys
CREATE POLICY "System can insert stay surveys"
ON public.stay_surveys
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create indexes for faster queries
CREATE INDEX idx_stay_surveys_reservation_id ON public.stay_surveys(reservation_id);
CREATE INDEX idx_stay_surveys_rating ON public.stay_surveys(overall_rating);
CREATE INDEX idx_stay_surveys_submitted_at ON public.stay_surveys(submitted_at);
CREATE INDEX idx_reservations_survey_sent ON public.reservations(survey_sent_at);
CREATE INDEX idx_reservations_checkout ON public.reservations(check_out_date, survey_sent_at);