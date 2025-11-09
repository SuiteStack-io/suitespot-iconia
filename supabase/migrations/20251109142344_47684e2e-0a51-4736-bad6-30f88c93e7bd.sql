-- Create the our-story-slideshow storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('our-story-slideshow', 'our-story-slideshow', true);

-- Create RLS policies for the our-story-slideshow bucket

-- Allow anyone to view images (public bucket)
CREATE POLICY "Anyone can view our story slideshow images"
ON storage.objects FOR SELECT
USING (bucket_id = 'our-story-slideshow');

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload our story slideshow images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'our-story-slideshow');

-- Allow authenticated users to update images
CREATE POLICY "Authenticated users can update our story slideshow images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'our-story-slideshow');

-- Allow authenticated users to delete images
CREATE POLICY "Authenticated users can delete our story slideshow images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'our-story-slideshow');