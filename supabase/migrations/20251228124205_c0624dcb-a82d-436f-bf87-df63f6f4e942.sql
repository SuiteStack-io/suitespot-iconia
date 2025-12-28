-- Add commission_paid column to track payment status
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS commission_paid text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.reservations.commission_paid IS 'Tracks if commission has been paid to team member. NULL = unpaid, yes = paid';