-- Create ticket surveys table
CREATE TABLE public.ticket_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.guest_tickets(id) ON DELETE CASCADE,
  guest_account_id UUID NOT NULL REFERENCES public.guest_accounts(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  resolution_satisfaction INTEGER CHECK (resolution_satisfaction >= 1 AND resolution_satisfaction <= 5),
  response_time_satisfaction INTEGER CHECK (response_time_satisfaction >= 1 AND response_time_satisfaction <= 5),
  would_recommend BOOLEAN,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ticket_surveys ENABLE ROW LEVEL SECURITY;

-- Admins can view all surveys
CREATE POLICY "Admins can view all surveys"
ON public.ticket_surveys
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert surveys
CREATE POLICY "System can insert surveys"
ON public.ticket_surveys
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_ticket_surveys_ticket_id ON public.ticket_surveys(ticket_id);
CREATE INDEX idx_ticket_surveys_rating ON public.ticket_surveys(rating);
CREATE INDEX idx_ticket_surveys_submitted_at ON public.ticket_surveys(submitted_at);