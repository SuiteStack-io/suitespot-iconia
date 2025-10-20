-- Drop existing policies on storage.objects for assets bucket
DROP POLICY IF EXISTS "Public access to assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload assets" ON storage.objects;

-- Allow anyone to view assets (public bucket)
CREATE POLICY "Anyone can view assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'assets');

-- Allow authenticated users to insert into assets bucket
CREATE POLICY "Authenticated can insert assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'assets');

-- Allow authenticated users to update assets
CREATE POLICY "Authenticated can update assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'assets')
WITH CHECK (bucket_id = 'assets');

-- Allow authenticated users to delete assets
CREATE POLICY "Authenticated can delete assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'assets');