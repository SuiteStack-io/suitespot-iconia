-- Set REPLICA IDENTITY FULL on reservations table for real-time updates
ALTER TABLE public.reservations REPLICA IDENTITY FULL;