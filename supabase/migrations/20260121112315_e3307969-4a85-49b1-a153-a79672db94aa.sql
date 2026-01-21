-- Fix operator precedence bug in auto-status update function
-- The bug was causing checked-in reservations to be marked as completed incorrectly

CREATE OR REPLACE FUNCTION public.update_reservation_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Update to 'completed' for reservations that have been checked-out for more than 1 hour
  -- NOTE: Added parentheses to ensure status = 'checked-out' is always required
  UPDATE reservations
  SET status = 'completed'
  WHERE status = 'checked-out'
    AND (
      check_out_date < CURRENT_DATE
      OR (check_out_date = CURRENT_DATE AND CURRENT_TIME >= TIME '01:00:00')
    );
END;
$function$;

-- Repair incorrectly updated reservations
-- Restore reservations that were marked as completed but never actually checked out
UPDATE reservations
SET status = 'checked-in'
WHERE status = 'completed'
  AND checked_out_at IS NULL
  AND check_out_date >= CURRENT_DATE;