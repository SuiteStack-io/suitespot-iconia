-- Add booking_com_id column to rate_plans table for Booking.com integration
ALTER TABLE public.rate_plans 
ADD COLUMN booking_com_id text;

-- Create unique index for Booking.com ID (only for non-null values)
CREATE UNIQUE INDEX idx_rate_plans_booking_com_id 
ON public.rate_plans(booking_com_id) 
WHERE booking_com_id IS NOT NULL;