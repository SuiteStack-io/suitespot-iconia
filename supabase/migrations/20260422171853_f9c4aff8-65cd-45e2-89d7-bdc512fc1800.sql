-- 1. Update profiles SELECT policy to include super_admin
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins and super admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- 2. Update get_all_users_with_emails() to allow super_admin
CREATE OR REPLACE FUNCTION public.get_all_users_with_emails()
 RETURNS TABLE(user_id uuid, email text, full_name text, role app_role)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow both admins and super admins to call this function
  IF NOT (has_role(auth.uid(), 'admin'::app_role)
       OR has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Only admins can access user information';
  END IF;

  RETURN QUERY
  SELECT 
    p.id as user_id,
    au.email::text,
    p.full_name,
    ur.role
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  ORDER BY p.created_at DESC;
END;
$function$;