-- Update storage policies to allow admins to download documents

-- Drop and recreate policies for admins viewing documents
DROP POLICY IF EXISTS "Admins can view id passports" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view marriage certificates" ON storage.objects;
DROP POLICY IF EXISTS "Admins can download id passports" ON storage.objects;
DROP POLICY IF EXISTS "Admins can download marriage certificates" ON storage.objects;

-- Allow admins to view and download ID/passport documents
CREATE POLICY "Admins can view id passports"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'id-passports' 
  AND (
    auth.uid() IS NOT NULL 
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Allow admins to view and download marriage certificates
CREATE POLICY "Admins can view marriage certificates"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'marriage-certificates' 
  AND (
    auth.uid() IS NOT NULL 
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);