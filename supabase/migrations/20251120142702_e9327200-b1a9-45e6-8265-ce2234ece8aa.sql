-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Function to create notification for new reservations
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
  
  -- Create notification for all admins
  INSERT INTO notifications (user_id, type, title, message, metadata)
  SELECT 
    ur.user_id,
    'info',
    'New Reservation',
    'New booking for ' || COALESCE(unit_name, 'Unknown Unit') || ' from ' || 
    NEW.guest_names[1] || ' (' || NEW.check_in_date || ' to ' || NEW.check_out_date || ')',
    jsonb_build_object(
      'reservation_id', NEW.id,
      'unit_id', NEW.unit_id,
      'check_in', NEW.check_in_date,
      'check_out', NEW.check_out_date
    )
  FROM user_roles ur
  WHERE ur.role = 'admin'::app_role OR ur.role = 'manager'::app_role;
  
  RETURN NEW;
END;
$$;

-- Trigger for new reservations
DROP TRIGGER IF EXISTS on_new_reservation ON reservations;
CREATE TRIGGER on_new_reservation
  AFTER INSERT ON reservations
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed')
  EXECUTE FUNCTION notify_new_reservation();

-- Function to create notification for new tickets
CREATE OR REPLACE FUNCTION notify_new_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create notification for all admins and managers
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
  WHERE ur.role IN ('admin'::app_role, 'manager'::app_role);
  
  RETURN NEW;
END;
$$;

-- Trigger for new tickets
DROP TRIGGER IF EXISTS on_new_ticket ON guest_tickets;
CREATE TRIGGER on_new_ticket
  AFTER INSERT ON guest_tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_ticket();

-- Function to create notification for ticket status changes
CREATE OR REPLACE FUNCTION notify_ticket_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only notify if status changed
  IF OLD.status != NEW.status THEN
    -- Notify assigned user if ticket is assigned or status changed
    IF NEW.assigned_to IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, metadata)
      VALUES (
        NEW.assigned_to,
        CASE 
          WHEN NEW.status = 'resolved' THEN 'success'
          ELSE 'info'
        END,
        'Ticket Updated: ' || NEW.title,
        'Status changed from ' || OLD.status || ' to ' || NEW.status,
        jsonb_build_object(
          'ticket_id', NEW.id,
          'old_status', OLD.status,
          'new_status', NEW.status
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for ticket status changes
DROP TRIGGER IF EXISTS on_ticket_status_change ON guest_tickets;
CREATE TRIGGER on_ticket_status_change
  AFTER UPDATE ON guest_tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_ticket_status_change();

-- Function to create notification for ticket assignments
CREATE OR REPLACE FUNCTION notify_ticket_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only notify if assigned_to changed and is not null
  IF (OLD.assigned_to IS NULL AND NEW.assigned_to IS NOT NULL) OR
     (OLD.assigned_to IS NOT NULL AND NEW.assigned_to IS NOT NULL AND OLD.assigned_to != NEW.assigned_to) THEN
    INSERT INTO notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.assigned_to,
      CASE 
        WHEN NEW.priority = 'urgent' THEN 'error'
        WHEN NEW.priority = 'high' THEN 'warning'
        ELSE 'info'
      END,
      'Ticket Assigned: ' || NEW.title,
      'A ' || NEW.priority || ' priority ticket has been assigned to you',
      jsonb_build_object(
        'ticket_id', NEW.id,
        'priority', NEW.priority,
        'type', NEW.ticket_type
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for ticket assignments
DROP TRIGGER IF EXISTS on_ticket_assignment ON guest_tickets;
CREATE TRIGGER on_ticket_assignment
  AFTER UPDATE ON guest_tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_ticket_assignment();