-- Update check_and_lock_unit_availability to also check blocked_dates
CREATE OR REPLACE FUNCTION public.check_and_lock_unit_availability(
  p_unit_id uuid, 
  p_check_in_date date, 
  p_check_out_date date
)
RETURNS TABLE(is_available boolean, unit_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_has_conflict BOOLEAN;
  v_has_blocked_dates BOOLEAN;
BEGIN
  -- Lock the unit row to prevent concurrent allocations
  PERFORM id FROM units WHERE id = p_unit_id FOR UPDATE;
  
  -- Check for reservation conflicts
  SELECT EXISTS(
    SELECT 1 FROM reservations
    WHERE reservations.unit_id = p_unit_id
      AND status = 'confirmed'
      AND check_in_date < p_check_out_date
      AND check_out_date > p_check_in_date
  ) INTO v_has_conflict;
  
  -- Check for blocked dates within the reservation period
  SELECT EXISTS(
    SELECT 1 FROM blocked_dates
    WHERE blocked_dates.unit_id = p_unit_id
      AND blocked_date >= p_check_in_date
      AND blocked_date < p_check_out_date
  ) INTO v_has_blocked_dates;
  
  -- Return availability: must have NO conflicts AND NO blocked dates
  RETURN QUERY SELECT (NOT v_has_conflict AND NOT v_has_blocked_dates) AS is_available, p_unit_id;
END;
$function$;