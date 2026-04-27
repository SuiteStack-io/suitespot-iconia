CREATE OR REPLACE FUNCTION public.check_reservation_against_blocked_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conflict_count integer;
  first_blocked_date date;
  first_blocked_reason text;
  unit_label text;
BEGIN
  IF (NEW.unit_id IS NOT DISTINCT FROM OLD.unit_id)
     AND (NEW.check_in_date IS NOT DISTINCT FROM OLD.check_in_date)
     AND (NEW.check_out_date IS NOT DISTINCT FROM OLD.check_out_date) THEN
    RETURN NEW;
  END IF;

  IF NEW.unit_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*), MIN(blocked_date), (
    SELECT reason FROM public.blocked_dates
    WHERE unit_id = NEW.unit_id
      AND blocked_date >= NEW.check_in_date
      AND blocked_date < NEW.check_out_date
    ORDER BY blocked_date ASC LIMIT 1
  )
  INTO conflict_count, first_blocked_date, first_blocked_reason
  FROM public.blocked_dates
  WHERE unit_id = NEW.unit_id
    AND blocked_date >= NEW.check_in_date
    AND blocked_date < NEW.check_out_date;

  IF conflict_count > 0 THEN
    SELECT COALESCE(unit_number, name, NEW.unit_id::text) INTO unit_label
    FROM public.units WHERE id = NEW.unit_id;

    RAISE EXCEPTION
      'Cannot assign reservation to unit %: % blocked date(s) found in [%, %). First blocked date: % (reason: %)',
      unit_label,
      conflict_count,
      NEW.check_in_date,
      NEW.check_out_date,
      first_blocked_date,
      COALESCE(first_blocked_reason, 'no reason given')
    USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_reservation_blocked_dates ON public.reservations;
CREATE TRIGGER prevent_reservation_blocked_dates
BEFORE UPDATE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.check_reservation_against_blocked_dates();