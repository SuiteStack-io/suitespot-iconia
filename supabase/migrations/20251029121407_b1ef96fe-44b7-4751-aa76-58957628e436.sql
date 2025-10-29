-- Create id-passports bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('id-passports', 'id-passports', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can upload id passports" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view id passports" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload marriage certificates" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view marriage certificates" ON storage.objects;

-- Allow anyone to upload ID/passport documents
CREATE POLICY "Anyone can upload id passports"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'id-passports');

-- Allow admins to view ID/passport documents
CREATE POLICY "Admins can view id passports"
ON storage.objects
FOR SELECT
USING (bucket_id = 'id-passports' AND has_role(auth.uid(), 'admin'::app_role));

-- Allow anyone to upload marriage certificates
CREATE POLICY "Anyone can upload marriage certificates"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'marriage-certificates');

-- Allow admins to view marriage certificates
CREATE POLICY "Admins can view marriage certificates"
ON storage.objects
FOR SELECT
USING (bucket_id = 'marriage-certificates' AND has_role(auth.uid(), 'admin'::app_role));