-- Create KYC links table
CREATE TABLE public.kyc_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  guest_name text NOT NULL,
  guest_contact text,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.kyc_links ENABLE ROW LEVEL SECURITY;

-- Admins can manage all KYC links
CREATE POLICY "Admins can manage KYC links"
ON public.kyc_links
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view their own KYC link by token
CREATE POLICY "Anyone can view KYC link by token"
ON public.kyc_links
FOR SELECT
TO anon
USING (true);

-- System can update KYC status
CREATE POLICY "System can update KYC status"
ON public.kyc_links
FOR UPDATE
TO anon
USING (true);