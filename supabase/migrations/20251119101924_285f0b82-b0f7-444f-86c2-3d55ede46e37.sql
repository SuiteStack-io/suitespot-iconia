-- Create table to log Booking.com sync operations
CREATE TABLE IF NOT EXISTS booking_com_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL, -- 'push_availability', 'pull_reservation', 'webhook'
  direction TEXT NOT NULL, -- 'inbound', 'outbound'
  unit_id UUID REFERENCES units(id),
  booking_com_room_id TEXT,
  status TEXT NOT NULL, -- 'success', 'error', 'pending'
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_booking_com_sync_log_created_at ON booking_com_sync_log(created_at DESC);
CREATE INDEX idx_booking_com_sync_log_status ON booking_com_sync_log(status);

-- Enable RLS
ALTER TABLE booking_com_sync_log ENABLE ROW LEVEL SECURITY;

-- Admins can view sync logs
CREATE POLICY "Admins can view sync logs"
ON booking_com_sync_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert sync logs
CREATE POLICY "System can insert sync logs"
ON booking_com_sync_log
FOR INSERT
WITH CHECK (true);