-- Allow anonymous users to view reservation dates (for availability checking)
CREATE POLICY "Anyone can view reservation dates for availability"
ON public.reservations
FOR SELECT
TO anon
USING (status = 'confirmed');