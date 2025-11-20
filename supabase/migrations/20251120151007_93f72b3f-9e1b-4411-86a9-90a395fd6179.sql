-- Update notification function for new reservations to include booking source
CREATE OR REPLACE FUNCTION notify_new_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  unit_name TEXT;
BEGIN
  -- Get unit name
  SELECT name INTO unit_name FROM units WHERE id = NEW.unit_id;
  
  -- Create notification for all admins and managers
  INSERT INTO notifications (user_id, type, title, message, metadata)
  SELECT 
    ur.user_id,
    'info',
    'New Reservation',
    'New booking for ' || COALESCE(unit_name, 'Unknown Unit') || ' from ' || 
    NEW.guest_names[1] || ' (' || NEW.check_in_date || ' to ' || NEW.check_out_date || ')',
    jsonb_build_object(
      'source', COALESCE(NEW.channel, NEW.source, 'Unknown'),
      'channel', NEW.channel,
      'unit_id', NEW.unit_id,
      'check_in', NEW.check_in_date,
      'check_out', NEW.check_out_date
    )
  FROM user_roles ur
  WHERE ur.role = 'admin'::app_role OR ur.role = 'manager'::app_role;
  
  RETURN NEW;
END;
$$;

-- Function to notify admins when a reservation's room is reassigned
CREATE OR REPLACE FUNCTION notify_room_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_unit_name TEXT;
  new_unit_name TEXT;
BEGIN
  -- Only notify if unit_id has changed and is not null
  IF OLD.unit_id IS DISTINCT FROM NEW.unit_id AND OLD.unit_id IS NOT NULL AND NEW.unit_id IS NOT NULL THEN
    -- Get unit names
    SELECT name INTO old_unit_name FROM units WHERE id = OLD.unit_id;
    SELECT name INTO new_unit_name FROM units WHERE id = NEW.unit_id;
    
    -- Create notification for all admins
    INSERT INTO notifications (user_id, type, title, message, metadata)
    SELECT 
      ur.user_id,
      'warning',
      'Room Reassignment - Action Required',
      NEW.guest_names[1] || ' reservation moved from ' || COALESCE(old_unit_name, 'Room ' || OLD.unit_id) || ' to ' || COALESCE(new_unit_name, 'Room ' || NEW.unit_id) || ' due to double booking conflict. Please notify guest.',
      jsonb_build_object(
        'source', COALESCE(NEW.channel, NEW.source, 'Unknown'),
        'channel', NEW.channel,
        'old_room', old_unit_name,
        'new_room', new_unit_name,
        'check_in', NEW.check_in_date,
        'check_out', NEW.check_out_date
      )
    FROM user_roles ur
    WHERE ur.role = 'admin'::app_role;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_room_reassignment ON reservations;

-- Create trigger for room reassignment notifications
CREATE TRIGGER on_room_reassignment
  AFTER UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION notify_room_reassignment();