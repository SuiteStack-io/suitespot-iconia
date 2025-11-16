-- Add proper refresh_token column to sync_status
ALTER TABLE sync_status 
ADD COLUMN IF NOT EXISTS refresh_token TEXT;

-- Create sync_logs table
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  status TEXT NOT NULL,
  bookings_created INTEGER DEFAULT 0,
  bookings_skipped INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on sync_logs
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view sync logs" ON sync_logs;
DROP POLICY IF EXISTS "System can insert sync logs" ON sync_logs;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can view all notifications" ON notifications;

-- RLS Policies for sync_logs
CREATE POLICY "Admins can view sync logs" ON sync_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert sync logs" ON sync_logs
  FOR INSERT WITH CHECK (true);

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all notifications" ON notifications
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Create function to notify admins on sync error
CREATE OR REPLACE FUNCTION notify_admins_on_sync_error()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    WHERE ur.role = 'admin'::app_role;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for sync error notifications
DROP TRIGGER IF EXISTS sync_error_notification_trigger ON sync_status;
CREATE TRIGGER sync_error_notification_trigger
  AFTER UPDATE ON sync_status
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_on_sync_error();