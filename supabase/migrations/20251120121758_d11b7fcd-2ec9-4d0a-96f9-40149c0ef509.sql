-- Fix function search path for generate_guest_username
CREATE OR REPLACE FUNCTION generate_guest_username(p_guest_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
  v_counter integer := 1;
  v_base_username text;
BEGIN
  -- Convert name to lowercase and replace spaces with underscores
  v_base_username := lower(regexp_replace(trim(p_guest_name), '\s+', '_', 'g'));
  v_username := v_base_username;
  
  -- Check if username exists, if so, append number
  WHILE EXISTS (SELECT 1 FROM guest_accounts WHERE username = v_username) LOOP
    v_username := v_base_username || '_' || v_counter;
    v_counter := v_counter + 1;
  END LOOP;
  
  RETURN v_username;
END;
$$;