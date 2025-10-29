-- Grant INSERT permission to anon and authenticated roles on reservations table
GRANT INSERT ON public.reservations TO anon;
GRANT INSERT ON public.reservations TO authenticated;