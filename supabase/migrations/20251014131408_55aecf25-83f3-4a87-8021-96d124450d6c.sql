-- Add source column to reservations table
ALTER TABLE public.reservations 
ADD COLUMN source text NOT NULL DEFAULT 'booking.com' 
CHECK (source IN ('booking.com', 'Direct website', 'Referral'));