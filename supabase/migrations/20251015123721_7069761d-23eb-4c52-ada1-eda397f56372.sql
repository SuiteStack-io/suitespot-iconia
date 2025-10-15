-- Create a function to get all users with their emails (admin only)
CREATE OR REPLACE FUNCTION public.get_all_users_with_emails()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  role app_role
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to call this function
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
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
$$;