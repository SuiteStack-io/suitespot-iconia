ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS valid_dates;
ALTER TABLE public.reservations ADD CONSTRAINT valid_dates CHECK (check_out_date >= check_in_date);