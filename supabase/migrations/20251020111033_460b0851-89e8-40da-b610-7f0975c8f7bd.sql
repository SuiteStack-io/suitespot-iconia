-- Add RLS policies for marriage-certificates bucket to allow authenticated users to view files

-- Allow authenticated users to view all files in the bucket
CREATE POLICY "Authenticated users can view documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'marriage-certificates');

-- Keep existing upload policy
-- Note: The existing upload policies should remain unchanged