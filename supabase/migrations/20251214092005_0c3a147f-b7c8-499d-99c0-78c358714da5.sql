-- Add settled column to reservations table
ALTER TABLE public.reservations ADD COLUMN settled text;

-- Update existing Booking.com reservations to have settled = 'booking_com'
UPDATE public.reservations 
SET settled = 'booking_com' 
WHERE payment_method = 'booking_com';