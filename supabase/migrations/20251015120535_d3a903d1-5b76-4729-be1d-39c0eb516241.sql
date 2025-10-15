-- Drop the old source check constraint
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_source_check;

-- Add updated source check constraint with the actual sources being used
ALTER TABLE public.reservations ADD CONSTRAINT reservations_source_check 
  CHECK (source = ANY (ARRAY['Emad'::text, 'Nicola'::text, 'Youssef'::text, 'KSS'::text, 'booking.com'::text, 'Direct website'::text, 'Referral'::text]));