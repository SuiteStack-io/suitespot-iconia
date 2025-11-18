-- Function 1: Detailed overlap check returning conflict details
CREATE OR REPLACE FUNCTION public.check_reservation_overlap(
  p_unit_id uuid,
  p_check_in_date date,
  p_check_out_date date,
  p_exclude_id uuid DEFAULT NULL
)
RETURNS TABLE(
  conflict_id uuid,
  conflict_reference text,
  conflict_guest_names text[],
  conflict_check_in date,
  conflict_check_out date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    AND r.status = 'confirmed'
    AND (p_exclude_id IS NULL OR r.id != p_exclude_id)
    AND r.check_in_date < p_check_out_date
    AND r.check_out_date > p_check_in_date
  ORDER BY r.check_in_date;
END;
$$;

-- Function 2: Simple boolean check
CREATE OR REPLACE FUNCTION public.has_reservation_conflict(
  p_unit_id uuid,
  p_check_in_date date,
  p_check_out_date date,
  p_exclude_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conflict_count integer;
BEGIN
  SELECT COUNT(*)
  INTO conflict_count
  FROM reservations r
  WHERE r.unit_id = p_unit_id
    AND r.status = 'confirmed'
    AND (p_exclude_id IS NULL OR r.id != p_exclude_id)
    AND r.check_in_date < p_check_out_date
    AND r.check_out_date > p_check_in_date;
  
  RETURN conflict_count > 0;
END;
$$;

-- Function 3: Trigger function to prevent overlaps
CREATE OR REPLACE FUNCTION public.prevent_reservation_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conflict_record RECORD;
  unit_info RECORD;
BEGIN
  -- Only check for confirmed reservations
  IF NEW.status != 'confirmed' THEN
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
$$;

-- Trigger: Apply the prevention function to reservations table
DROP TRIGGER IF EXISTS check_reservation_overlap_trigger ON reservations;

CREATE TRIGGER check_reservation_overlap_trigger
  BEFORE INSERT OR UPDATE ON reservations
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed')
  EXECUTE FUNCTION prevent_reservation_overlap();

-- Add composite index for faster conflict checks
CREATE INDEX IF NOT EXISTS idx_reservations_overlap_check 
ON reservations(unit_id, status, check_in_date, check_out_date)
WHERE status = 'confirmed';

-- Add comments for documentation
COMMENT ON FUNCTION check_reservation_overlap IS 'Returns detailed information about conflicting reservations for a given unit and date range';
COMMENT ON FUNCTION has_reservation_conflict IS 'Returns true if the reservation would conflict with existing bookings';
COMMENT ON FUNCTION prevent_reservation_overlap IS 'Trigger function that prevents overlapping reservations at database level';