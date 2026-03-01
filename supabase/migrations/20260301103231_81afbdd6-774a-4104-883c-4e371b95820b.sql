
CREATE OR REPLACE FUNCTION public.auto_grant_admin_property_access()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_property_access (user_id, property_id, role, granted_by)
  SELECT ur.user_id, NEW.id, 'admin', NEW.created_by
  FROM public.user_roles ur
  WHERE ur.role = 'admin'::app_role
    AND ur.user_id IS DISTINCT FROM NEW.created_by
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_grant_admin_property_access
  AFTER INSERT ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_grant_admin_property_access();
