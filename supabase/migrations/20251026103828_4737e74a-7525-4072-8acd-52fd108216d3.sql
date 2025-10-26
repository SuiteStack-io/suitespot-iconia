-- Add booking.com ID column to units table for matching reservations
ALTER TABLE public.units 
ADD COLUMN booking_com_id TEXT UNIQUE;

-- Add index for faster lookups
CREATE INDEX idx_units_booking_com_id ON public.units(booking_com_id);

COMMENT ON COLUMN public.units.booking_com_id IS 'Unique identifier from Booking.com for automatic reservation matching';