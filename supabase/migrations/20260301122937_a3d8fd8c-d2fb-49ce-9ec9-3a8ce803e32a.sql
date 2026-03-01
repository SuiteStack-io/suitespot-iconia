
-- 1) Update user_has_property_access to treat app-role 'admin' as global access
CREATE OR REPLACE FUNCTION public.user_has_property_access(property_uuid uuid, required_role text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- System admins bypass everything
  IF is_system_admin(auth.uid()) THEN RETURN TRUE; END IF;

  -- App-role admins also get global property access
  IF has_role(auth.uid(), 'admin'::app_role) THEN RETURN TRUE; END IF;

  IF required_role IS NULL THEN
    RETURN has_property_access(auth.uid(), property_uuid);
  END IF;
  RETURN has_property_role(auth.uid(), property_uuid,
    CASE required_role
      WHEN 'viewer' THEN ARRAY['owner','admin','manager','staff','viewer']
      WHEN 'staff' THEN ARRAY['owner','admin','manager','staff']
      WHEN 'manager' THEN ARRAY['owner','admin','manager']
      WHEN 'admin' THEN ARRAY['owner','admin']
      WHEN 'owner' THEN ARRAY['owner']
    END
  );
END;
$function$;

-- 2) Backfill: give every admin user access to every property they don't already have
INSERT INTO public.user_property_access (user_id, property_id, role)
SELECT ur.user_id, p.id, 'admin'
FROM public.user_roles ur
CROSS JOIN public.properties p
WHERE ur.role = 'admin'::app_role
ON CONFLICT (user_id, property_id) DO NOTHING;
