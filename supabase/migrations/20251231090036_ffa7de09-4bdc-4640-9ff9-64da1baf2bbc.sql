-- Allow anonymous users to view reservations for guest check-in form
-- This policy allows read-only access to reservations for the guest check-in process
CREATE POLICY "Allow public access to reservations for guest check-in"
ON public.reservations
FOR SELECT
TO anon
USING (status IN ('confirmed', 'checked-in'));