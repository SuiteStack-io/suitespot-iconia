-- Fix RLS policies for user_roles table
-- Drop the existing "ALL" policy which might not be working correctly for INSERT
DROP POLICY IF EXISTS "Admins can manage all roles" ON user_roles;

-- Create separate explicit policies for each operation
CREATE POLICY "Admins can insert roles"
ON user_roles FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update roles"
ON user_roles FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roles"
ON user_roles FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));