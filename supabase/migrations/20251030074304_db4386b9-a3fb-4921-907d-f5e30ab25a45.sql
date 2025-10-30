-- Create slideshow_images table
CREATE TABLE public.slideshow_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url text NOT NULL,
  sequence_order integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.slideshow_images ENABLE ROW LEVEL SECURITY;

-- Anyone can view slideshow images
CREATE POLICY "Anyone can view slideshow images"
ON public.slideshow_images
FOR SELECT
USING (true);

-- Only admins can insert slideshow images
CREATE POLICY "Admins can insert slideshow images"
ON public.slideshow_images
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update slideshow images
CREATE POLICY "Admins can update slideshow images"
ON public.slideshow_images
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete slideshow images
CREATE POLICY "Admins can delete slideshow images"
ON public.slideshow_images
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for slideshow images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('slideshow', 'slideshow', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for slideshow bucket
CREATE POLICY "Anyone can view slideshow images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'slideshow');

CREATE POLICY "Admins can upload slideshow images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'slideshow' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete slideshow images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'slideshow' 
  AND has_role(auth.uid(), 'admin'::app_role)
);