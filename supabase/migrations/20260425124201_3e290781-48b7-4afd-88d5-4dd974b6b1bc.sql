ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS landlord_share_percentage numeric NOT NULL DEFAULT 70;

UPDATE public.properties
  SET landlord_share_percentage = 70
  WHERE landlord_share_percentage IS NULL;