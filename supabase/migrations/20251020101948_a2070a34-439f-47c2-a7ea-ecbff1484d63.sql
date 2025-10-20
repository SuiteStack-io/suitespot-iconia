-- Create storage bucket for marriage certificates
INSERT INTO storage.buckets (id, name, public)
VALUES ('marriage-certificates', 'marriage-certificates', false);

-- Create RLS policies for marriage certificates bucket
CREATE POLICY "Authenticated users can upload their marriage certificates"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'marriage-certificates' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can view their own marriage certificates"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'marriage-certificates' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can view all marriage certificates"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'marriage-certificates' AND
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete marriage certificates"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'marriage-certificates' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Add marriage certificate URL and guest genders to reservations table
ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS marriage_certificate_url text,
ADD COLUMN IF NOT EXISTS guest_genders text[];