-- Add column to track when last cleaning notification was sent
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS last_cleaning_notification_date date DEFAULT NULL;

-- Update the notify_mid_stay_cleaning function to support every 4 days
CREATE OR REPLACE FUNCTION public.notify_mid_stay_cleaning()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reservation RECORD;
  v_unit_name TEXT;
  v_day_of_stay INTEGER;
  v_cleaning_number INTEGER;
BEGIN
  -- Find reservations that are due for cleaning (every 4 days: day 4, 8, 12, 16...)
  FOR v_reservation IN
    SELECT r.id, r.guest_names, r.unit_id, r.check_in_date, r.check_out_date, r.last_cleaning_notification_date
    FROM reservations r
    WHERE r.status = 'checked-in'
      -- Calculate day of stay (1-indexed)
      AND (CURRENT_DATE - r.check_in_date + 1) >= 4
      -- Check if today is a cleaning day (every 4 days)
      AND (CURRENT_DATE - r.check_in_date + 1) % 4 = 0
      -- Haven't sent notification today
      AND (r.last_cleaning_notification_date IS NULL OR r.last_cleaning_notification_date < CURRENT_DATE)
  LOOP
    -- Get unit name
    SELECT name INTO v_unit_name FROM units WHERE id = v_reservation.unit_id;
    
    -- Calculate day of stay and cleaning number
    v_day_of_stay := CURRENT_DATE - v_reservation.check_in_date + 1;
    v_cleaning_number := v_day_of_stay / 4;
    
    -- Create notifications for housekeeping staff
    INSERT INTO notifications (user_id, type, title, message, metadata)
    SELECT 
      ur.user_id,
      'info',
      'Scheduled Cleaning Required',
      'Room ' || COALESCE(v_unit_name, 'Unknown') || ' needs cleaning #' || v_cleaning_number || ' (Day ' || v_day_of_stay || ' of stay). Guest: ' || v_reservation.guest_names[1],
      jsonb_build_object(
        'reservation_id', v_reservation.id,
        'unit_id', v_reservation.unit_id,
        'cleaning_type', 'scheduled',
        'stay_day', v_day_of_stay,
        'cleaning_number', v_cleaning_number
      )
    FROM user_roles ur
    WHERE ur.role = 'housekeeping'::app_role;
    
    -- Update the last notification date
    UPDATE reservations 
    SET last_cleaning_notification_date = CURRENT_DATE 
    WHERE id = v_reservation.id;
  END LOOP;
END;
$function$;