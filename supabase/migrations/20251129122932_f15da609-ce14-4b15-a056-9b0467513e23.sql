-- Add column to track mid-stay cleaning completion
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS mid_stay_cleaning_completed BOOLEAN DEFAULT false;

-- Create function to check and notify for mid-stay cleaning
CREATE OR REPLACE FUNCTION notify_mid_stay_cleaning()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reservation RECORD;
  v_unit_name TEXT;
BEGIN
  -- Find reservations on their 4th day (check_in_date + 3 days = today)
  FOR v_reservation IN
    SELECT r.id, r.guest_names, r.unit_id, r.check_in_date, r.check_out_date
    FROM reservations r
    WHERE r.status = 'checked-in'
      AND r.check_in_date + INTERVAL '3 days' = CURRENT_DATE
      AND r.mid_stay_cleaning_completed = false
  LOOP
    -- Get unit name
    SELECT name INTO v_unit_name FROM units WHERE id = v_reservation.unit_id;
    
    -- Create notifications for housekeeping staff
    INSERT INTO notifications (user_id, type, title, message, metadata)
    SELECT 
      ur.user_id,
      'info',
      'Mid-Stay Cleaning Required',
      'Room ' || COALESCE(v_unit_name, 'Unknown') || ' needs mid-stay cleaning (Day 4 of stay). Guest: ' || v_reservation.guest_names[1],
      jsonb_build_object(
        'reservation_id', v_reservation.id,
        'unit_id', v_reservation.unit_id,
        'cleaning_type', 'mid_stay',
        'stay_day', 4
      )
    FROM user_roles ur
    WHERE ur.role = 'housekeeping'::app_role;
  END LOOP;
END;
$$;