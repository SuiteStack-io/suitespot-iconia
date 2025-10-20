-- Drop the old restrictive upload policy
DROP POLICY IF EXISTS "Authenticated users can upload assets" ON storage.objects;

-- Create a new policy that properly allows authenticated users to upload
CREATE POLICY "Authenticated users can upload assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'assets');