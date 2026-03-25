
CREATE OR REPLACE FUNCTION public.delete_property_with_dependencies(p_property_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_default boolean;
  v_active_count integer;
BEGIN
  -- Check if property exists
  SELECT is_default INTO v_is_default FROM properties WHERE id = p_property_id;
  IF v_is_default IS NULL THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  -- Block default property deletion
  IF v_is_default THEN
    RAISE EXCEPTION 'Cannot delete the default property';
  END IF;

  -- Block if active reservations exist
  SELECT COUNT(*) INTO v_active_count
  FROM reservations
  WHERE property_id = p_property_id AND status IN ('confirmed', 'checked-in');
  
  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete property with active bookings';
  END IF;

  -- Delete in FK-safe order

  -- 1. Children of reservations (that reference reservation_id)
  DELETE FROM guest_tickets WHERE reservation_id IN (SELECT id FROM reservations WHERE property_id = p_property_id);
  DELETE FROM ticket_surveys WHERE reservation_id IN (SELECT id FROM reservations WHERE property_id = p_property_id);
  DELETE FROM guest_accounts WHERE reservation_id IN (SELECT id FROM reservations WHERE property_id = p_property_id);
  DELETE FROM stay_surveys WHERE reservation_id IN (SELECT id FROM reservations WHERE property_id = p_property_id);
  DELETE FROM check_in_agreements WHERE reservation_id IN (SELECT id FROM reservations WHERE property_id = p_property_id);
  DELETE FROM housekeeping_logs WHERE reservation_id IN (SELECT id FROM reservations WHERE property_id = p_property_id);

  -- 2. Tables with property_id (no children or children already cleared)
  DELETE FROM messages WHERE thread_id IN (SELECT id FROM message_threads WHERE property_id = p_property_id);
  DELETE FROM message_threads WHERE property_id = p_property_id;
  DELETE FROM whatsapp_message_log WHERE property_id = p_property_id;
  DELETE FROM room_shuffle_log WHERE property_id = p_property_id;
  DELETE FROM summary_report_log WHERE property_id = p_property_id;
  DELETE FROM channex_sync_logs WHERE property_id = p_property_id;
  DELETE FROM channex_alerts WHERE property_id = p_property_id;
  DELETE FROM channex_sync_queue WHERE property_id = p_property_id;

  -- 3. Reservations (children cleared above)
  DELETE FROM reservations WHERE property_id = p_property_id;

  -- 4. Children of rate_plans
  DELETE FROM rate_plan_prices WHERE rate_plan_id IN (SELECT id FROM rate_plans WHERE property_id = p_property_id);
  DELETE FROM rate_plan_restrictions WHERE rate_plan_id IN (SELECT id FROM rate_plans WHERE property_id = p_property_id);
  DELETE FROM rate_plan_value_adds WHERE rate_plan_id IN (SELECT id FROM rate_plans WHERE property_id = p_property_id);
  DELETE FROM rate_plan_date_overrides WHERE rate_plan_id IN (SELECT id FROM rate_plans WHERE property_id = p_property_id);
  DELETE FROM channex_bookings WHERE rate_plan_id IN (SELECT id FROM rate_plans WHERE property_id = p_property_id);
  DELETE FROM derived_rate_plan_mappings WHERE property_id = p_property_id;
  DELETE FROM channel_markup_settings WHERE property_id = p_property_id;

  -- 5. Rate plans
  DELETE FROM rate_plans WHERE property_id = p_property_id;

  -- 6. Children of units
  DELETE FROM blocked_dates WHERE unit_id IN (SELECT id FROM units WHERE property_id = p_property_id);
  DELETE FROM booking_com_sync_log WHERE unit_id IN (SELECT id FROM units WHERE property_id = p_property_id);
  DELETE FROM property_amenities WHERE unit_id IN (SELECT id FROM units WHERE property_id = p_property_id);
  DELETE FROM nearby_amenities WHERE unit_id IN (SELECT id FROM units WHERE property_id = p_property_id);
  DELETE FROM media_library WHERE unit_id IN (SELECT id FROM units WHERE property_id = p_property_id);
  DELETE FROM guest_inventory_access WHERE unit_id IN (SELECT id FROM units WHERE property_id = p_property_id);
  DELETE FROM kyc_links WHERE unit_id IN (SELECT id FROM units WHERE property_id = p_property_id);
  DELETE FROM rate_plan_prices WHERE unit_id IN (SELECT id FROM units WHERE property_id = p_property_id);
  DELETE FROM channex_bookings WHERE room_type_id IN (SELECT id FROM units WHERE property_id = p_property_id);

  -- 7. Units
  DELETE FROM units WHERE property_id = p_property_id;

  -- 8. User access
  DELETE FROM user_property_access WHERE property_id = p_property_id;

  -- 9. Property itself
  DELETE FROM properties WHERE id = p_property_id;
END;
$$;
