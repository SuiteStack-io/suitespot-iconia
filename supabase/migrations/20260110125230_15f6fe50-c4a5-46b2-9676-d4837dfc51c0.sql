-- Update check_reservation_overlap to include checked-in status
CREATE OR REPLACE FUNCTION public.check_reservation_overlap(p_unit_id uuid, p_check_in_date date, p_check_out_date date, p_exclude_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(conflict_id uuid, conflict_reference text, conflict_guest_names text[], conflict_check_in date, conflict_check_out date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.booking_reference,
    r.guest_names,
    r.check_in_date,
    r.check_out_date
  FROM reservations r
  WHERE r.unit_id = p_unit_id
    AND r.status IN ('confirmed', 'checked-in')
    AND (p_exclude_id IS NULL OR r.id != p_exclude_id)
    AND r.check_in_date < p_check_out_date
    AND r.check_out_date > p_check_in_date
  ORDER BY r.check_in_date;
END;
$function$;

-- Update has_reservation_conflict to include checked-in status
CREATE OR REPLACE FUNCTION public.has_reservation_conflict(p_unit_id uuid, p_check_in_date date, p_check_out_date date, p_exclude_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  conflict_count integer;
BEGIN
  SELECT COUNT(*)
  INTO conflict_count
  FROM reservations r
  WHERE r.unit_id = p_unit_id
    AND r.status IN ('confirmed', 'checked-in')
    AND (p_exclude_id IS NULL OR r.id != p_exclude_id)
    AND r.check_in_date < p_check_out_date
    AND r.check_out_date > p_check_in_date;
  
  RETURN conflict_count > 0;
END;
$function$;

-- Update check_and_lock_unit_availability to include checked-in status
CREATE OR REPLACE FUNCTION public.check_and_lock_unit_availability(p_unit_id uuid, p_check_in_date date, p_check_out_date date)
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
  
  -- Check for reservation conflicts (both confirmed and checked-in)
  SELECT EXISTS(
    SELECT 1 FROM reservations
    WHERE reservations.unit_id = p_unit_id
      AND status IN ('confirmed', 'checked-in')
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

-- Update prevent_reservation_overlap trigger function to include checked-in status
CREATE OR REPLACE FUNCTION public.prevent_reservation_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  conflict_record RECORD;
  unit_info RECORD;
BEGIN
  -- Only check for confirmed or checked-in reservations
  IF NEW.status NOT IN ('confirmed', 'checked-in') THEN
    RETURN NEW;
  END IF;

  -- Check for conflicts
  SELECT * INTO conflict_record
  FROM public.check_reservation_overlap(
    NEW.unit_id,
    NEW.check_in_date,
    NEW.check_out_date,
    NEW.id
  )
  LIMIT 1;

  -- If conflict found, raise error with details
  IF FOUND THEN
    -- Get unit details for better error message
    SELECT name, unit_number INTO unit_info
    FROM units
    WHERE id = NEW.unit_id;

    RAISE EXCEPTION 'RESERVATION CONFLICT: Unit % (%) is already booked from % to % (Ref: %). Guest: %',
      unit_info.name,
      unit_info.unit_number,
      conflict_record.conflict_check_in,
      conflict_record.conflict_check_out,
      conflict_record.conflict_reference,
      conflict_record.conflict_guest_names[1];
  END IF;

  RETURN NEW;
END;
$function$;

-- Drop old index and create new one that includes both statuses
DROP INDEX IF EXISTS idx_reservations_conflict_check;
CREATE INDEX idx_reservations_conflict_check ON public.reservations (unit_id, check_in_date, check_out_date) 
WHERE status IN ('confirmed', 'checked-in');