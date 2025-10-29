-- Allow public users to create bookings through the website booking flow
CREATE POLICY "Allow public website bookings"
ON public.reservations
FOR INSERT
TO anon
WITH CHECK (
  source = 'direct website' 
  AND status = 'confirmed'
);