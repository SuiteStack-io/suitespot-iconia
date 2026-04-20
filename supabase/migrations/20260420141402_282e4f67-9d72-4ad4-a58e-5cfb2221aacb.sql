ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS from_email_reservations text,
  ADD COLUMN IF NOT EXISTS from_email_frontdesk text,
  ADD COLUMN IF NOT EXISTS from_email_notifications text,
  ADD COLUMN IF NOT EXISTS from_email_housekeeping text,
  ADD COLUMN IF NOT EXISTS from_email_ai text,
  ADD COLUMN IF NOT EXISTS from_name text,
  ADD COLUMN IF NOT EXISTS support_email text,
  ADD COLUMN IF NOT EXISTS support_phone text,
  ADD COLUMN IF NOT EXISTS support_whatsapp text,
  ADD COLUMN IF NOT EXISTS wifi_network text,
  ADD COLUMN IF NOT EXISTS wifi_password text,
  ADD COLUMN IF NOT EXISTS vat_rate numeric DEFAULT 14,
  ADD COLUMN IF NOT EXISTS default_commission_rate numeric DEFAULT 10;