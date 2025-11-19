-- Create function to check unit availability with row-level locking
-- This prevents race conditions during concurrent unit allocation
CREATE OR REPLACE FUNCTION check_and_lock_unit_availability(
  p_unit_id UUID,
  p_check_in_date DATE,
  p_check_out_date DATE
)
RETURNS TABLE (
  is_available BOOLEAN,
  unit_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_conflict BOOLEAN;
BEGIN
  -- Lock the unit row to prevent concurrent allocations (FOR UPDATE blocks other transactions)
  PERFORM id FROM units WHERE id = p_unit_id FOR UPDATE;
  
  -- Check for reservation conflicts
  SELECT EXISTS(
    SELECT 1 FROM reservations
    WHERE unit_id = p_unit_id
      AND status = 'confirmed'
      AND check_in_date < p_check_out_date
      AND check_out_date > p_check_in_date
  ) INTO v_has_conflict;
  
  -- Return availability status
  RETURN QUERY SELECT NOT v_has_conflict AS is_available, p_unit_id;
END;
$$;