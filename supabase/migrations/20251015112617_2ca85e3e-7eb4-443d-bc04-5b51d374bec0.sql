-- Assign admin role to Youssef's account
INSERT INTO user_roles (user_id, role)
VALUES ('d540b87e-f856-4ef1-9193-2fb077366ef9', 'admin');

-- Update RLS policies for reservations table to allow managers
DROP POLICY IF EXISTS "Admins and front desk can insert reservations" ON reservations;
CREATE POLICY "Admins and managers can insert reservations"
ON reservations FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

DROP POLICY IF EXISTS "Admins and front desk can update reservations" ON reservations;
CREATE POLICY "Admins and managers can update reservations"
ON reservations FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);