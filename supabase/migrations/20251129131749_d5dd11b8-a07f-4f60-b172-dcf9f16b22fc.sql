-- Add optimization columns to slideshow_images table
ALTER TABLE slideshow_images 
ADD COLUMN IF NOT EXISTS blur_placeholder TEXT,
ADD COLUMN IF NOT EXISTS image_url_sm TEXT,
ADD COLUMN IF NOT EXISTS image_url_md TEXT,
ADD COLUMN IF NOT EXISTS image_url_lg TEXT;

-- Add optimization columns to our_story_slideshow table
ALTER TABLE our_story_slideshow 
ADD COLUMN IF NOT EXISTS blur_placeholder TEXT,
ADD COLUMN IF NOT EXISTS image_url_sm TEXT,
ADD COLUMN IF NOT EXISTS image_url_md TEXT,
ADD COLUMN IF NOT EXISTS image_url_lg TEXT;

-- Add comments for documentation
COMMENT ON COLUMN slideshow_images.blur_placeholder IS 'Base64 encoded 20x20px blur placeholder for instant loading';
COMMENT ON COLUMN slideshow_images.image_url_sm IS 'Small responsive image (640px width) for mobile devices';
COMMENT ON COLUMN slideshow_images.image_url_md IS 'Medium responsive image (1280px width) for tablets';
COMMENT ON COLUMN slideshow_images.image_url_lg IS 'Large responsive image (1920px width) for desktop';

COMMENT ON COLUMN our_story_slideshow.blur_placeholder IS 'Base64 encoded 20x20px blur placeholder for instant loading';
COMMENT ON COLUMN our_story_slideshow.image_url_sm IS 'Small responsive image (640px width) for mobile devices';
COMMENT ON COLUMN our_story_slideshow.image_url_md IS 'Medium responsive image (1280px width) for tablets';
COMMENT ON COLUMN our_story_slideshow.image_url_lg IS 'Large responsive image (1920px width) for desktop';