-- Create public assets bucket for logos and other public files
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true);

-- Create RLS policy to allow anyone to read from assets bucket
CREATE POLICY "Public access to assets"
ON storage.objects
FOR SELECT
USING (bucket_id = 'assets');

-- Create RLS policy to allow authenticated users to upload to assets bucket
CREATE POLICY "Authenticated users can upload assets"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'assets' AND auth.role() = 'authenticated');