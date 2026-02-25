
-- Update properties SELECT policy to allow admin-role users
DROP POLICY IF EXISTS "Users can view assigned properties" ON public.properties;
CREATE POLICY "Users can view assigned properties" ON public.properties
  FOR SELECT TO authenticated
  USING (
    public.has_property_access(auth.uid(), id)
    OR public.is_system_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Also allow admin-role users to INSERT properties
DROP POLICY IF EXISTS "Property owners can create properties" ON public.properties;
DROP POLICY IF EXISTS "System admins can create properties" ON public.properties;
DROP POLICY IF EXISTS "Admins can create properties" ON public.properties;
CREATE POLICY "Admins can create properties" ON public.properties
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_system_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Allow admin-role users to UPDATE properties
DROP POLICY IF EXISTS "Property admins can update properties" ON public.properties;
DROP POLICY IF EXISTS "Admins can update properties" ON public.properties;
CREATE POLICY "Admins can update properties" ON public.properties
  FOR UPDATE TO authenticated
  USING (
    public.is_system_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_property_role(auth.uid(), id, ARRAY['owner', 'admin'])
  );

-- Allow admin-role users to DELETE properties
DROP POLICY IF EXISTS "System admins can delete properties" ON public.properties;
DROP POLICY IF EXISTS "Admins can delete properties" ON public.properties;
CREATE POLICY "Admins can delete properties" ON public.properties
  FOR DELETE TO authenticated
  USING (
    public.is_system_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );
