-- Add commission_paid_at column to track payment date
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS commission_paid_at timestamp with time zone DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.reservations.commission_paid_at IS 'Timestamp when commission was marked as paid';