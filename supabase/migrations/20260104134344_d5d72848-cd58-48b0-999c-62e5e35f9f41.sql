-- Add vat_exempt column to reservations table
ALTER TABLE public.reservations 
ADD COLUMN vat_exempt BOOLEAN DEFAULT false;