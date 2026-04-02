CREATE OR REPLACE FUNCTION public.notify_channex_rate_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rate_plan_id uuid;
  v_mapping_record record;
BEGIN
  v_rate_plan_id := COALESCE(NEW.rate_plan_id, OLD.rate_plan_id);

  IF v_rate_plan_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT cm.id, cm.local_id, cm.channex_id
  INTO v_mapping_record
  FROM channex_mappings cm
  WHERE cm.local_id = v_rate_plan_id
    AND cm.entity_type = 'rate_plan'
    AND cm.sync_status = 'synced'
  LIMIT 1;

  IF v_mapping_record IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO channex_sync_queue (sync_type, entity_id, payload)
  VALUES (
    'rate',
    v_mapping_record.local_id,
    jsonb_build_object(
      'rate_plan_id', v_rate_plan_id,
      'room_type', COALESCE(NEW.room_type, OLD.room_type),
      'weekday_rate', COALESCE(NEW.weekday_rate, OLD.weekday_rate),
      'weekend_rate', COALESCE(NEW.weekend_rate, OLD.weekend_rate),
      'off_peak_rate', COALESCE(NEW.off_peak_rate, OLD.off_peak_rate),
      'triggered_by', 'rate_plan_prices'
    )
  );

  PERFORM net.http_post(
    url := 'https://phvduifvymozqiqwvajj.supabase.co/functions/v1/channex-process-sync-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;