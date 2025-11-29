-- Update the automatic reservation status function to only handle Completed status
CREATE OR REPLACE FUNCTION public.update_reservation_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Update to 'completed' for reservations that have been checked-out for more than 1 hour
  UPDATE reservations
  SET status = 'completed'
  WHERE status = 'checked-out'
    AND check_out_date < CURRENT_DATE
    OR (check_out_date = CURRENT_DATE AND CURRENT_TIME >= TIME '01:00:00');
END;
$function$;