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
  -- Skip validation for shuffle moves (BFS algorithm pre-validates)
  IF NEW.shuffled_from_unit_id IS NOT NULL 
     AND (OLD.shuffled_from_unit_id IS NULL OR NEW.shuffled_from_unit_id != OLD.shuffled_from_unit_id) THEN
    RETURN NEW;
  END IF;

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