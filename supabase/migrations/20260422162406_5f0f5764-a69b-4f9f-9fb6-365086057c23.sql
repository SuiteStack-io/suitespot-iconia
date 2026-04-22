-- ── 1. Update has-access helper: drop 'owner' arms, add super_admin early return ──
CREATE OR REPLACE FUNCTION public.user_has_property_access(property_uuid uuid, required_role text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- System admins bypass everything
  IF is_system_admin(auth.uid()) THEN RETURN TRUE; END IF;

  -- Super admins (Hostbase platform operators) bypass everything
  IF has_role(auth.uid(), 'super_admin'::app_role) THEN RETURN TRUE; END IF;

  -- App-role admins also get global property access
  IF has_role(auth.uid(), 'admin'::app_role) THEN RETURN TRUE; END IF;

  IF required_role IS NULL THEN
    RETURN has_property_access(auth.uid(), property_uuid);
  END IF;
  RETURN has_property_role(auth.uid(), property_uuid,
    CASE required_role
      WHEN 'viewer'  THEN ARRAY['admin','manager','staff','viewer']
      WHEN 'staff'   THEN ARRAY['admin','manager','staff']
      WHEN 'manager' THEN ARRAY['admin','manager']
      WHEN 'admin'   THEN ARRAY['admin']
    END
  );
END;
$function$;

-- ── 2. Replace auto-assign trigger (owner → admin) ──
DROP TRIGGER IF EXISTS trigger_auto_assign_property_owner ON public.properties;
DROP FUNCTION IF EXISTS public.auto_assign_property_owner();

CREATE OR REPLACE FUNCTION public.auto_assign_property_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip super_admins — they already have global access
  IF NEW.created_by IS NOT NULL
     AND NOT has_role(NEW.created_by, 'super_admin'::app_role) THEN
    INSERT INTO public.user_property_access (user_id, property_id, role, granted_by)
    VALUES (NEW.created_by, NEW.id, 'admin', NEW.created_by)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trigger_auto_assign_property_admin
AFTER INSERT ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_property_admin();

-- ── 3. RLS rewrites: properties ──
DROP POLICY IF EXISTS "Property owners and admins can update" ON public.properties;
DROP POLICY IF EXISTS "Admins can update properties" ON public.properties;
DROP POLICY IF EXISTS "Property owners can delete" ON public.properties;
DROP POLICY IF EXISTS "Admins can delete properties" ON public.properties;

CREATE POLICY "Property admins and super admins can update properties"
ON public.properties
FOR UPDATE
USING (
  has_property_role(auth.uid(), id, ARRAY['admin'])
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR is_system_admin(auth.uid())
);

CREATE POLICY "Super admins and system admins can delete properties"
ON public.properties
FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR is_system_admin(auth.uid())
);

-- ── 4. RLS rewrites: user_property_access ──
DROP POLICY IF EXISTS "Users can view their property access" ON public.user_property_access;
DROP POLICY IF EXISTS "Property owners/admins can insert access" ON public.user_property_access;
DROP POLICY IF EXISTS "Property owners/admins can update access" ON public.user_property_access;
DROP POLICY IF EXISTS "Property owners/admins can delete access" ON public.user_property_access;

CREATE POLICY "Users and property admins can view access"
ON public.user_property_access
FOR SELECT
USING (
  user_id = auth.uid()
  OR has_property_role(auth.uid(), property_id, ARRAY['admin'])
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR is_system_admin(auth.uid())
);

CREATE POLICY "Property admins and super admins can insert access"
ON public.user_property_access
FOR INSERT
WITH CHECK (
  has_property_role(auth.uid(), property_id, ARRAY['admin'])
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR is_system_admin(auth.uid())
);

CREATE POLICY "Property admins and super admins can update access"
ON public.user_property_access
FOR UPDATE
USING (
  has_property_role(auth.uid(), property_id, ARRAY['admin'])
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR is_system_admin(auth.uid())
);

CREATE POLICY "Property admins and super admins can delete access"
ON public.user_property_access
FOR DELETE
USING (
  has_property_role(auth.uid(), property_id, ARRAY['admin'])
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR is_system_admin(auth.uid())
);