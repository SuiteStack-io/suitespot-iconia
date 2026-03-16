CREATE OR REPLACE FUNCTION public.notify_channex_availability_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_unit_id uuid;
  v_room_name text;
  v_date_from date;
  v_date_to date;
  v_mapping_record record;
  v_old_unit_id uuid;
  v_old_room_name text;
  v_old_date_from date;
  v_old_date_to date;
  v_old_mapping_record record;
BEGIN
  -- ── DELETE: restore availability including checkout day for cleanup ──
  IF TG_OP = 'DELETE' THEN
    v_unit_id := OLD.unit_id;
    v_date_from := OLD.check_in_date;
    v_date_to := OLD.check_out_date + interval '1 day';

    IF v_unit_id IS NULL THEN RETURN OLD; END IF;

    SELECT booking_com_name INTO v_room_name FROM units WHERE id = v_unit_id;
    IF v_room_name IS NULL THEN RETURN OLD; END IF;

    SELECT cm.id, cm.local_id, cm.channex_id INTO v_mapping_record
    FROM channex_mappings cm JOIN units u ON u.id = cm.local_id
    WHERE u.booking_com_name = v_room_name AND cm.entity_type = 'room_type' AND cm.sync_status = 'synced'
    LIMIT 1;

    IF v_mapping_record IS NULL THEN RETURN OLD; END IF;

    INSERT INTO channex_sync_queue (sync_type, entity_id, date_from, date_to, payload)
    VALUES ('availability', v_mapping_record.local_id, v_date_from, v_date_to,
            jsonb_build_object('room_type_name', v_room_name, 'triggered_by', 'reservation_delete'));

    PERFORM net.http_post(
      url := 'https://phvduifvymozqiqwvajj.supabase.co/functions/v1/channex-process-sync-queue',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
      body := '{}'::jsonb
    );
    RETURN OLD;
  END IF;

  -- ── INSERT: queue the new dates (check_out_date is exclusive boundary, loop excludes it) ──
  IF TG_OP = 'INSERT' THEN
    v_unit_id := NEW.unit_id;
    v_date_from := NEW.check_in_date;
    v_date_to := NEW.check_out_date;

    IF v_unit_id IS NULL THEN RETURN NEW; END IF;
    IF NEW.skip_channex_sync = true THEN RETURN NEW; END IF;
    IF NEW.channel = 'Channex' THEN RETURN NEW; END IF;
    IF NEW.status NOT IN ('confirmed', 'checked-in', 'cancelled', 'completed') THEN RETURN NEW; END IF;

    SELECT booking_com_name INTO v_room_name FROM units WHERE id = v_unit_id;
    IF v_room_name IS NULL THEN RETURN NEW; END IF;

    SELECT cm.id, cm.local_id, cm.channex_id INTO v_mapping_record
    FROM channex_mappings cm JOIN units u ON u.id = cm.local_id
    WHERE u.booking_com_name = v_room_name AND cm.entity_type = 'room_type' AND cm.sync_status = 'synced'
    LIMIT 1;

    IF v_mapping_record IS NULL THEN RETURN NEW; END IF;

    INSERT INTO channex_sync_queue (sync_type, entity_id, date_from, date_to, payload)
    VALUES ('availability', v_mapping_record.local_id, v_date_from, v_date_to,
            jsonb_build_object('room_type_name', v_room_name, 'triggered_by', 'reservation_insert'));

    PERFORM net.http_post(
      url := 'https://phvduifvymozqiqwvajj.supabase.co/functions/v1/channex-process-sync-queue',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
      body := '{}'::jsonb
    );
    RETURN NEW;
  END IF;

  -- ── UPDATE: handle date changes, unit changes, and cancellations ──
  IF NEW.skip_channex_sync = true THEN RETURN NEW; END IF;
  IF NEW.channel = 'Channex' THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('confirmed', 'checked-in', 'cancelled', 'completed') THEN RETURN NEW; END IF;

  -- Case 1: Status changed to cancelled/completed — restore availability including checkout day
  IF OLD.status IN ('confirmed', 'checked-in') AND NEW.status IN ('cancelled', 'completed') THEN
    v_unit_id := COALESCE(NEW.unit_id, OLD.unit_id);
    IF v_unit_id IS NOT NULL THEN
      SELECT booking_com_name INTO v_room_name FROM units WHERE id = v_unit_id;
      IF v_room_name IS NOT NULL THEN
        SELECT cm.id, cm.local_id, cm.channex_id INTO v_mapping_record
        FROM channex_mappings cm JOIN units u ON u.id = cm.local_id
        WHERE u.booking_com_name = v_room_name AND cm.entity_type = 'room_type' AND cm.sync_status = 'synced'
        LIMIT 1;

        IF v_mapping_record IS NOT NULL THEN
          INSERT INTO channex_sync_queue (sync_type, entity_id, date_from, date_to, payload)
          VALUES ('availability', v_mapping_record.local_id, OLD.check_in_date, OLD.check_out_date + interval '1 day',
                  jsonb_build_object('room_type_name', v_room_name, 'triggered_by', 'reservation_cancellation'));

          PERFORM net.http_post(
            url := 'https://phvduifvymozqiqwvajj.supabase.co/functions/v1/channex-process-sync-queue',
            headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
            body := '{}'::jsonb
          );
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Case 2: Dates or unit changed on an active reservation
  IF NEW.status IN ('confirmed', 'checked-in') THEN
    IF OLD.check_in_date IS DISTINCT FROM NEW.check_in_date
       OR OLD.check_out_date IS DISTINCT FROM NEW.check_out_date
       OR OLD.unit_id IS DISTINCT FROM NEW.unit_id THEN

      -- Queue sync for OLD date range (restore freed availability, include checkout day for cleanup)
      v_old_unit_id := OLD.unit_id;
      IF v_old_unit_id IS NOT NULL THEN
        SELECT booking_com_name INTO v_old_room_name FROM units WHERE id = v_old_unit_id;
        IF v_old_room_name IS NOT NULL THEN
          SELECT cm.id, cm.local_id, cm.channex_id INTO v_old_mapping_record
          FROM channex_mappings cm JOIN units u ON u.id = cm.local_id
          WHERE u.booking_com_name = v_old_room_name AND cm.entity_type = 'room_type' AND cm.sync_status = 'synced'
          LIMIT 1;

          IF v_old_mapping_record IS NOT NULL THEN
            INSERT INTO channex_sync_queue (sync_type, entity_id, date_from, date_to, payload)
            VALUES ('availability', v_old_mapping_record.local_id, OLD.check_in_date, OLD.check_out_date + interval '1 day',
                    jsonb_build_object('room_type_name', v_old_room_name, 'triggered_by', 'reservation_update_old_range'));
          END IF;
        END IF;
      END IF;

      -- Queue sync for NEW date range (reduce availability, check_out_date as exclusive boundary)
      v_unit_id := NEW.unit_id;
      IF v_unit_id IS NOT NULL THEN
        SELECT booking_com_name INTO v_room_name FROM units WHERE id = v_unit_id;
        IF v_room_name IS NOT NULL THEN
          SELECT cm.id, cm.local_id, cm.channex_id INTO v_mapping_record
          FROM channex_mappings cm JOIN units u ON u.id = cm.local_id
          WHERE u.booking_com_name = v_room_name AND cm.entity_type = 'room_type' AND cm.sync_status = 'synced'
          LIMIT 1;

          IF v_mapping_record IS NOT NULL THEN
            INSERT INTO channex_sync_queue (sync_type, entity_id, date_from, date_to, payload)
            VALUES ('availability', v_mapping_record.local_id, NEW.check_in_date, NEW.check_out_date,
                    jsonb_build_object('room_type_name', v_room_name, 'triggered_by', 'reservation_update_new_range'));
          END IF;
        END IF;
      END IF;

      PERFORM net.http_post(
        url := 'https://phvduifvymozqiqwvajj.supabase.co/functions/v1/channex-process-sync-queue',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
        body := '{}'::jsonb
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;