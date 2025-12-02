-- Create blog_posts table
CREATE TABLE public.blog_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  h1_title TEXT NOT NULL,
  h2_subtitle TEXT,
  slug TEXT NOT NULL UNIQUE,
  content TEXT,
  excerpt TEXT,
  featured_image_url TEXT,
  meta_title TEXT,
  meta_description TEXT,
  author_id UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Create index for slug lookups
CREATE INDEX idx_blog_posts_slug ON public.blog_posts(slug);

-- Create index for status filtering
CREATE INDEX idx_blog_posts_status ON public.blog_posts(status);

-- RLS Policies
-- Admins can do everything
CREATE POLICY "Admins can manage all blog posts"
ON public.blog_posts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view published posts
CREATE POLICY "Anyone can view published blog posts"
ON public.blog_posts
FOR SELECT
USING (status = 'published');

-- Trigger for updated_at
CREATE TRIGGER update_blog_posts_updated_at
BEFORE UPDATE ON public.blog_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();