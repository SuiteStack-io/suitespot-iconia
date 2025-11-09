-- Create table for Our Story slideshow images
CREATE TABLE public.our_story_slideshow (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.our_story_slideshow ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to view the slideshow images
CREATE POLICY "Anyone can view our story slideshow images" 
ON public.our_story_slideshow 
FOR SELECT 
USING (true);

-- Create policy for authenticated users to manage images
CREATE POLICY "Authenticated users can insert our story slideshow images" 
ON public.our_story_slideshow 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update our story slideshow images" 
ON public.our_story_slideshow 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete our story slideshow images" 
ON public.our_story_slideshow 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Create index for better performance
CREATE INDEX idx_our_story_slideshow_order ON public.our_story_slideshow(sequence_order);

-- Enable realtime for the table
ALTER PUBLICATION supabase_realtime ADD TABLE public.our_story_slideshow;