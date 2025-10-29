-- Allow anyone to view available units for public booking
DROP POLICY IF EXISTS "Anyone can view available units" ON public.units;

CREATE POLICY "Anyone can view available units"
ON public.units
FOR SELECT
USING (true);

-- Keep admin management policy
-- (The existing "Admins can manage units" policy for INSERT/UPDATE/DELETE remains unchanged)