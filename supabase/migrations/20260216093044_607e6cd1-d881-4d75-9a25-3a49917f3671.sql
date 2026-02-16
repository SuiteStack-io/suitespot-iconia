
-- ============================================================
-- 1. channex_sync_queue table
-- ============================================================
CREATE TABLE public.channex_sync_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type text NOT NULL,  -- 'availability' or 'rate'
  property_id uuid,
  entity_id uuid,           -- local room-type id or rate-plan id
  date_from date,
  date_to date,
  payload jsonb,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.channex_sync_queue ENABLE ROW LEVEL SECURITY;

-- Only service-role can read/write (system table)
CREATE POLICY "Service role full access on sync queue"
  ON public.channex_sync_queue
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 2. Add skip_channex_sync to reservations
-- ============================================================
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS skip_channex_sync boolean NOT NULL DEFAULT false;

-- ============================================================
-- 3. Trigger function: reservation changes → availability queue
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_channex_availability_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_unit_id uuid;
  v_room_name text;
  v_date_from date;
  v_date_to date;
  v_mapping_record record;
BEGIN
  -- Determine the relevant unit_id
  IF TG_OP = 'DELETE' THEN
    v_unit_id := OLD.unit_id;
    v_date_from := OLD.check_in_date;
    v_date_to := OLD.check_out_date;
  ELSE
    v_unit_id := NEW.unit_id;
    v_date_from := NEW.check_in_date;
    v_date_to := NEW.check_out_date;
  END IF;

  -- No unit assigned, nothing to sync
  IF v_unit_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Skip if flagged to prevent loop
  IF TG_OP != 'DELETE' AND NEW.skip_channex_sync = true THEN
    RETURN NEW;
  END IF;

  -- Skip if booking came from Channex
  IF TG_OP != 'DELETE' AND NEW.channel = 'Channex' THEN
    RETURN NEW;
  END IF;

  -- Only care about statuses that affect availability
  IF TG_OP != 'DELETE' AND NEW.status NOT IN ('confirmed', 'checked-in', 'cancelled', 'completed') THEN
    RETURN NEW;
  END IF;

  -- Look up room type name for this unit
  SELECT booking_com_name INTO v_room_name
  FROM units WHERE id = v_unit_id;

  IF v_room_name IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Check if any unit with the same room type is mapped to Channex
  SELECT cm.id, cm.local_id, cm.channex_id
  INTO v_mapping_record
  FROM channex_mappings cm
  JOIN units u ON u.id = cm.local_id
  WHERE u.booking_com_name = v_room_name
    AND cm.entity_type = 'room_type'
    AND cm.sync_status = 'synced'
  LIMIT 1;

  -- Not synced to Channex, skip
  IF v_mapping_record IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Queue the availability sync
  INSERT INTO channex_sync_queue (sync_type, entity_id, date_from, date_to, payload)
  VALUES (
    'availability',
    v_mapping_record.local_id,
    v_date_from,
    v_date_to,
    jsonb_build_object('room_type_name', v_room_name, 'triggered_by', 'reservation')
  );

  -- Fire-and-forget call to the processing edge function
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
$$;

CREATE TRIGGER on_reservation_change_channex
  AFTER INSERT OR UPDATE OR DELETE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_channex_availability_change();

-- ============================================================
-- 4. Trigger function: blocked_dates changes → availability queue
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_channex_blocked_dates_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_unit_id uuid;
  v_blocked_date date;
  v_room_name text;
  v_mapping_record record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_unit_id := OLD.unit_id;
    v_blocked_date := OLD.blocked_date;
  ELSE
    v_unit_id := NEW.unit_id;
    v_blocked_date := NEW.blocked_date;
  END IF;

  IF v_unit_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT booking_com_name INTO v_room_name
  FROM units WHERE id = v_unit_id;

  IF v_room_name IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT cm.id, cm.local_id, cm.channex_id
  INTO v_mapping_record
  FROM channex_mappings cm
  JOIN units u ON u.id = cm.local_id
  WHERE u.booking_com_name = v_room_name
    AND cm.entity_type = 'room_type'
    AND cm.sync_status = 'synced'
  LIMIT 1;

  IF v_mapping_record IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO channex_sync_queue (sync_type, entity_id, date_from, date_to, payload)
  VALUES (
    'availability',
    v_mapping_record.local_id,
    v_blocked_date,
    v_blocked_date + 1,
    jsonb_build_object('room_type_name', v_room_name, 'triggered_by', 'blocked_date')
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
$$;

CREATE TRIGGER on_blocked_dates_change_channex
  AFTER INSERT OR DELETE ON public.blocked_dates
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_channex_blocked_dates_change();

-- ============================================================
-- 5. Trigger function: rate_plan_prices changes → rate queue
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_channex_rate_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rate_plan_id uuid;
  v_mapping_record record;
BEGIN
  v_rate_plan_id := COALESCE(NEW.rate_plan_id, OLD.rate_plan_id);

  IF v_rate_plan_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Check if this rate plan is synced to Channex
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
$$;

CREATE TRIGGER on_rate_plan_prices_change_channex
  AFTER INSERT OR UPDATE ON public.rate_plan_prices
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_channex_rate_change();
