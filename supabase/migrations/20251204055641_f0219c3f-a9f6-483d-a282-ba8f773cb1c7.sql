-- Add email delivery status tracking columns to reservations table
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS confirmation_email_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS confirmation_email_error TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.reservations.confirmation_email_status IS 'Status of guest confirmation email: sent, failed, or null (not attempted)';