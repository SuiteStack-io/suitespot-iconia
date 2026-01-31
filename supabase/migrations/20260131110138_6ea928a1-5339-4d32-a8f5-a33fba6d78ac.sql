-- Restore front desk ability to update reservations for check-in/check-out
DROP POLICY IF EXISTS "Admins and managers can update reservations" ON reservations;

CREATE POLICY "Admins, managers, and front desk can update reservations"
ON reservations FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'front_desk'::app_role)
);