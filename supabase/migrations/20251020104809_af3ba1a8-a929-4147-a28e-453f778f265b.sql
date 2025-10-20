-- Add second id_passport_url column for back of ID
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS id_passport_url_back text;