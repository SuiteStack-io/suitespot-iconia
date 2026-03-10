ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS channex_booking_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_channex_booking_id 
  ON public.reservations(channex_booking_id) WHERE channex_booking_id IS NOT NULL;