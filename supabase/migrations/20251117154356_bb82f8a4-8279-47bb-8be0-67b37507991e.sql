-- Add booking screenshot URL field to reservations table
ALTER TABLE public.reservations 
ADD COLUMN booking_screenshot_url TEXT;

COMMENT ON COLUMN public.reservations.booking_screenshot_url IS 'URL of the Booking.com screenshot used to create this reservation';

-- Create storage bucket for booking screenshots if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('booking-screenshots', 'booking-screenshots', false, 20971520, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies for booking screenshots bucket
CREATE POLICY "Authenticated users can upload booking screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'booking-screenshots');

CREATE POLICY "Authenticated users can view booking screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'booking-screenshots');

CREATE POLICY "Authenticated users can delete booking screenshots"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'booking-screenshots');