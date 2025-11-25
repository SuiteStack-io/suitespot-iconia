-- Add min_stay and payment_terms columns to units table
ALTER TABLE public.units 
ADD COLUMN min_stay integer,
ADD COLUMN payment_terms text;

COMMENT ON COLUMN public.units.min_stay IS 'Minimum number of nights required for booking';
COMMENT ON COLUMN public.units.payment_terms IS 'Payment terms and conditions for this property';