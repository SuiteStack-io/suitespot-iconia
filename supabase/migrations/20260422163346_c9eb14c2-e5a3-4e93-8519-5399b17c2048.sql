DROP POLICY IF EXISTS "Users can view assigned properties" ON public.properties;
DROP POLICY IF EXISTS "Users and admins can view properties" ON public.properties;

CREATE POLICY "Users and admins can view properties"
ON public.properties
FOR SELECT
USING (
  has_property_access(auth.uid(), id)
  OR is_system_admin(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);