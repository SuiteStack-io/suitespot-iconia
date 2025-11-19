-- Fix security warning: Set search_path for the function
CREATE OR REPLACE FUNCTION get_units_by_booking_com_room_id(p_room_id TEXT)
RETURNS TABLE (
  id UUID,
  unit_number TEXT,
  name TEXT,
  status TEXT,
  last_allocated_at TIMESTAMPTZ
) 
LANGUAGE plpgsql 
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.unit_number,
    u.name,
    u.status,
    u.last_allocated_at
  FROM units u
  WHERE u.booking_com_id = p_room_id
    AND u.status != 'maintenance'
  ORDER BY u.last_allocated_at ASC NULLS FIRST;
END;
$$;