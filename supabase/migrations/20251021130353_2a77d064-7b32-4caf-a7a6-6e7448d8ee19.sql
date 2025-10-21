-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a cron job to sync Gmail every 10 minutes
SELECT cron.schedule(
  'sync-booking-gmail-every-10-minutes',
  '*/10 * * * *', -- Every 10 minutes
  $$
  SELECT
    net.http_post(
        url:='https://phvduifvymozqiqwvajj.supabase.co/functions/v1/sync-booking-gmail',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBodmR1aWZ2eW1venFpcXd2YWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzOTA5NjksImV4cCI6MjA3NTk2Njk2OX0.dUvKctUckLL2ZErxKjeek1rtRptZPTG8Mrklm4eMPZQ"}'::jsonb,
        body:='{"automated": true}'::jsonb
    ) as request_id;
  $$
);

-- Update sync_status to track automated syncs
UPDATE sync_status 
SET sync_interval_minutes = 10 
WHERE sync_type = 'gmail';

-- If no record exists, create one
INSERT INTO sync_status (sync_type, sync_interval_minutes, status)
VALUES ('gmail', 10, 'idle')
ON CONFLICT DO NOTHING;