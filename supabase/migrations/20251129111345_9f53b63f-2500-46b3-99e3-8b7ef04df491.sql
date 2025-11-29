-- Create function to automatically update reservation statuses based on dates
CREATE OR REPLACE FUNCTION public.update_reservation_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update to 'checked-out' for reservations past check-out date
  UPDATE reservations
  SET status = 'checked-out'
  WHERE status = 'confirmed'
    AND check_out_date <= CURRENT_DATE;

  -- Note: We keep status as 'confirmed' for current in-house guests
  -- The Dashboard component will query based on dates for in-house count
  
END;
$$;

-- Create cron job to run status updates every hour
SELECT cron.schedule(
  'update-reservation-statuses',
  '0 * * * *', -- Run at the start of every hour
  $$
  SELECT public.update_reservation_statuses();
  $$
);