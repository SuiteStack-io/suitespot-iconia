-- Drop and recreate the admin/manager insert policy as PERMISSIVE (default)
DROP POLICY IF EXISTS "Admins and managers can insert reservations" ON public.reservations;

CREATE POLICY "Admins and managers can insert reservations"
ON public.reservations
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
);