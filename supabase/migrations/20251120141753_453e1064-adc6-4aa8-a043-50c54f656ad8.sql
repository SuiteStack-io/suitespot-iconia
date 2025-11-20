-- Create property photos bucket for unit images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-photos',
  'property-photos',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Create property documents bucket for contracts, manuals, etc.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-documents',
  'property-documents',
  false,
  52428800, -- 50MB
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;

-- RLS policies for property-photos bucket
CREATE POLICY "Anyone can view property photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'property-photos');

CREATE POLICY "Admins can upload property photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'property-photos' AND
  (SELECT has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Admins can update property photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'property-photos' AND
  (SELECT has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Admins can delete property photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'property-photos' AND
  (SELECT has_role(auth.uid(), 'admin'::app_role))
);

-- RLS policies for property-documents bucket
CREATE POLICY "Admins can view property documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'property-documents' AND
  (SELECT has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Admins can upload property documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'property-documents' AND
  (SELECT has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Admins can update property documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'property-documents' AND
  (SELECT has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Admins can delete property documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'property-documents' AND
  (SELECT has_role(auth.uid(), 'admin'::app_role))
);

-- Create media library table for tracking uploaded files
CREATE TABLE IF NOT EXISTS public.media_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  bucket_id TEXT NOT NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id),
  title TEXT,
  description TEXT,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;

-- RLS policies for media_library
CREATE POLICY "Anyone can view public media"
ON public.media_library FOR SELECT
TO public
USING (bucket_id = 'property-photos');

CREATE POLICY "Admins can manage all media"
ON public.media_library FOR ALL
TO authenticated
USING ((SELECT has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK ((SELECT has_role(auth.uid(), 'admin'::app_role)));

-- Create indexes for better performance
CREATE INDEX idx_media_library_unit_id ON public.media_library(unit_id);
CREATE INDEX idx_media_library_bucket_id ON public.media_library(bucket_id);
CREATE INDEX idx_media_library_tags ON public.media_library USING GIN(tags);
CREATE INDEX idx_media_library_created_at ON public.media_library(created_at DESC);

-- Trigger for updating updated_at
CREATE TRIGGER update_media_library_updated_at
BEFORE UPDATE ON public.media_library
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();