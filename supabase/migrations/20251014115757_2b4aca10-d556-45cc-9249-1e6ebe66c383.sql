-- Create sync_status table to track Booking.com sync state
CREATE TABLE public.sync_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL,
  last_sync_at timestamp with time zone,
  sync_interval_minutes integer NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'idle',
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(sync_type)
);

-- Enable RLS
ALTER TABLE public.sync_status ENABLE ROW LEVEL SECURITY;

-- Admins can manage sync status
CREATE POLICY "Admins can manage sync status"
ON public.sync_status
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can view sync status
CREATE POLICY "Authenticated users can view sync status"
ON public.sync_status
FOR SELECT
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_sync_status_updated_at
BEFORE UPDATE ON public.sync_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default booking.com sync status
INSERT INTO public.sync_status (sync_type, sync_interval_minutes)
VALUES ('booking_com_gmail', 10);