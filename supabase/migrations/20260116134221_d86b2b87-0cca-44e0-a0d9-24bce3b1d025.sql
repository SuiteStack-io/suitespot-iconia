CREATE OR REPLACE FUNCTION public.swap_reservation_rooms(
  reservation1_id uuid,
  reservation2_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  unit1_id uuid;
  unit2_id uuid;
BEGIN
  -- Get current unit IDs
  SELECT unit_id INTO unit1_id FROM reservations WHERE id = reservation1_id;
  SELECT unit_id INTO unit2_id FROM reservations WHERE id = reservation2_id;
  
  IF unit1_id IS NULL OR unit2_id IS NULL THEN
    RAISE EXCEPTION 'One or both reservations not found';
  END IF;
  
  -- Temporarily set both to NULL to avoid trigger conflicts
  UPDATE reservations SET unit_id = NULL WHERE id = reservation1_id;
  UPDATE reservations SET unit_id = NULL WHERE id = reservation2_id;
  
  -- Now swap the units
  UPDATE reservations SET unit_id = unit2_id WHERE id = reservation1_id;
  UPDATE reservations SET unit_id = unit1_id WHERE id = reservation2_id;
END;
$$;