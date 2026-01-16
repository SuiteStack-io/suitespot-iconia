-- Update notify_admins_on_sync_error to include front_desk
CREATE OR REPLACE FUNCTION public.notify_admins_on_sync_error()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'error' AND OLD.status != 'error' THEN
    INSERT INTO notifications (user_id, type, title, message, metadata)
    SELECT 
      ur.user_id,
      'error',
      'Gmail Sync Failed',
      COALESCE(NEW.error_message, 'Gmail sync encountered an error'),
      jsonb_build_object(
        'sync_type', NEW.sync_type,
        'last_sync_at', NEW.last_sync_at
      )
    FROM user_roles ur
    WHERE ur.role IN ('admin'::app_role, 'front_desk'::app_role);
  END IF;
  RETURN NEW;
END;
$function$;

-- Update notify_new_reservation to include front_desk
CREATE OR REPLACE FUNCTION public.notify_new_reservation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  unit_name TEXT;
BEGIN
  -- Get unit name
  SELECT name INTO unit_name FROM units WHERE id = NEW.unit_id;
  
  -- Create notification for all admins, managers, and front desk
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
  WHERE ur.role IN ('admin'::app_role, 'manager'::app_role, 'front_desk'::app_role);
  
  RETURN NEW;
END;
$function$;

-- Update notify_room_reassignment to include front_desk
CREATE OR REPLACE FUNCTION public.notify_room_reassignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  old_unit_name TEXT;
  new_unit_name TEXT;
BEGIN
  -- Only notify if unit_id has changed and is not null
  IF OLD.unit_id IS DISTINCT FROM NEW.unit_id AND OLD.unit_id IS NOT NULL AND NEW.unit_id IS NOT NULL THEN
    -- Get unit names
    SELECT name INTO old_unit_name FROM units WHERE id = OLD.unit_id;
    SELECT name INTO new_unit_name FROM units WHERE id = NEW.unit_id;
    
    -- Create notification for all admins and front desk
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
    WHERE ur.role IN ('admin'::app_role, 'front_desk'::app_role);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update notify_new_ticket to include front_desk
CREATE OR REPLACE FUNCTION public.notify_new_ticket()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Create notification for all admins, managers, and front desk
  INSERT INTO notifications (user_id, type, title, message, metadata)
  SELECT 
    ur.user_id,
    CASE 
      WHEN NEW.priority = 'urgent' THEN 'error'
      WHEN NEW.priority = 'high' THEN 'warning'
      ELSE 'info'
    END,
    'New Ticket: ' || NEW.title,
    'Priority: ' || NEW.priority || ' - ' || NEW.description,
    jsonb_build_object(
      'ticket_id', NEW.id,
      'priority', NEW.priority,
      'type', NEW.ticket_type
    )
  FROM user_roles ur
  WHERE ur.role IN ('admin'::app_role, 'manager'::app_role, 'front_desk'::app_role);
  
  RETURN NEW;
END;
$function$;

-- Update RLS policy for notifications to include front_desk
DROP POLICY IF EXISTS "Admins can view all notifications" ON notifications;

CREATE POLICY "Admins and front desk can view all notifications" ON notifications
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'front_desk'::app_role)
  );