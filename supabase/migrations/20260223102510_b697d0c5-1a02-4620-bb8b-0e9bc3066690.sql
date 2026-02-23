
-- Create room_shuffle_log table
CREATE TABLE public.room_shuffle_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shuffle_date timestamptz NOT NULL DEFAULT now(),
  triggered_by_booking_id uuid REFERENCES public.reservations(id),
  triggered_by_reference text NOT NULL,
  room_type text NOT NULL,
  moves jsonb NOT NULL DEFAULT '[]'::jsonb,
  move_count integer NOT NULL DEFAULT 0,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.room_shuffle_log ENABLE ROW LEVEL SECURITY;

-- Admin can view and manage shuffle logs
CREATE POLICY "Admins can manage shuffle logs"
ON public.room_shuffle_log
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert shuffle logs (edge function with service role)
CREATE POLICY "System can insert shuffle logs"
ON public.room_shuffle_log
FOR INSERT
WITH CHECK (true);

-- Add shuffle tracking columns to reservations
ALTER TABLE public.reservations
ADD COLUMN shuffled_from_unit_id uuid REFERENCES public.units(id),
ADD COLUMN shuffled_at timestamptz,
ADD COLUMN shuffle_log_id uuid REFERENCES public.room_shuffle_log(id);
