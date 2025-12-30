-- Create check_in_agreements table
CREATE TABLE public.check_in_agreements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  guest_full_name TEXT NOT NULL,
  guest_phone TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  signature_url TEXT NOT NULL,
  terms_accepted BOOLEAN NOT NULL DEFAULT true,
  signed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.check_in_agreements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all agreements"
ON public.check_in_agreements
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert agreements"
ON public.check_in_agreements
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view agreements by reservation"
ON public.check_in_agreements
FOR SELECT
USING (true);

-- Create signatures storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures', 'signatures', true);

-- Storage policies for signatures bucket
CREATE POLICY "Anyone can upload signatures"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'signatures');

CREATE POLICY "Anyone can view signatures"
ON storage.objects
FOR SELECT
USING (bucket_id = 'signatures');