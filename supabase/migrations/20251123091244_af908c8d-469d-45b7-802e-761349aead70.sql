-- Drop the old function
DROP FUNCTION IF EXISTS public.generate_guest_username(p_guest_name text);

-- Create updated function that accepts first and last name
CREATE OR REPLACE FUNCTION public.generate_guest_username(p_first_name text, p_last_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_username text;
  v_counter integer := 1;
  v_base_username text;
  v_full_name text;
BEGIN
  -- Combine first and last name
  v_full_name := trim(p_first_name) || ' ' || trim(p_last_name);
  
  -- Convert name to lowercase and replace spaces with underscores
  v_base_username := lower(regexp_replace(trim(v_full_name), '\s+', '_', 'g'));
  v_username := v_base_username;
  
  -- Check if username exists, if so, append number
  WHILE EXISTS (SELECT 1 FROM guest_accounts WHERE username = v_username) LOOP
    v_username := v_base_username || '_' || v_counter;
    v_counter := v_counter + 1;
  END LOOP;
  
  RETURN v_username;
END;
$function$;