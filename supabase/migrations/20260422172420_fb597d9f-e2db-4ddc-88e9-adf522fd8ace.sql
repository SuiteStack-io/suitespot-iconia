-- ============================================================
-- Normalize super_admin everywhere: RLS policies + functions
-- ============================================================

-- ─── 1. FUNCTIONS ───────────────────────────────────────────

-- has_permission: short-circuit for super_admin (covers every policy that calls it)
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result boolean;
BEGIN
  -- Admins and super admins always have all permissions
  IF has_role(_user_id, 'admin'::app_role) OR has_role(_user_id, 'super_admin'::app_role) THEN
    RETURN true;
  END IF;
  
  EXECUTE format(
    'SELECT %I FROM user_permissions WHERE user_id = $1',
    _permission
  ) INTO v_result USING _user_id;
  
  RETURN COALESCE(v_result, false);
END;
$function$;

-- reset_guest_password: allow super_admin
CREATE OR REPLACE FUNCTION public.reset_guest_password(p_account_id uuid, p_new_password_hash text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role)
       OR has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Only admins can reset guest passwords';
  END IF;
  
  UPDATE guest_accounts
  SET password_hash = p_new_password_hash
  WHERE id = p_account_id;
  
  RETURN FOUND;
END;
$function$;

-- notify_new_reservation: include super_admin recipients
CREATE OR REPLACE FUNCTION public.notify_new_reservation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  unit_name TEXT;
BEGIN
  SELECT name INTO unit_name FROM units WHERE id = NEW.unit_id;
  
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
  WHERE ur.role IN ('admin'::app_role, 'super_admin'::app_role, 'manager'::app_role, 'front_desk'::app_role);
  
  RETURN NEW;
END;
$function$;

-- notify_new_ticket: include super_admin recipients
CREATE OR REPLACE FUNCTION public.notify_new_ticket()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
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
  WHERE ur.role IN ('admin'::app_role, 'super_admin'::app_role, 'manager'::app_role, 'front_desk'::app_role);
  
  RETURN NEW;
END;
$function$;

-- notify_room_reassignment: include super_admin recipients
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
  IF OLD.unit_id IS DISTINCT FROM NEW.unit_id AND OLD.unit_id IS NOT NULL AND NEW.unit_id IS NOT NULL THEN
    SELECT name INTO old_unit_name FROM units WHERE id = OLD.unit_id;
    SELECT name INTO new_unit_name FROM units WHERE id = NEW.unit_id;
    
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
    WHERE ur.role IN ('admin'::app_role, 'super_admin'::app_role, 'front_desk'::app_role);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- notify_admins_on_sync_error: include super_admin recipients
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
    WHERE ur.role IN ('admin'::app_role, 'super_admin'::app_role, 'front_desk'::app_role);
  END IF;
  RETURN NEW;
END;
$function$;

-- auto_grant_admin_property_access: skip super_admins (they have global access)
CREATE OR REPLACE FUNCTION public.auto_grant_admin_property_access()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_property_access (user_id, property_id, role, granted_by)
  SELECT ur.user_id, NEW.id, 'admin', NEW.created_by
  FROM public.user_roles ur
  WHERE ur.role = 'admin'::app_role
    AND ur.user_id IS DISTINCT FROM NEW.created_by
    AND NOT has_role(ur.user_id, 'super_admin'::app_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

-- ─── 2. RLS POLICIES ─────────────────────────────────────────

-- audit_logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- blocked_dates (3)
DROP POLICY IF EXISTS "Users with permission can delete blocked dates" ON public.blocked_dates;
CREATE POLICY "Users with permission can delete blocked dates" ON public.blocked_dates FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_permission(auth.uid(), 'can_block_dates'::text));

DROP POLICY IF EXISTS "Users with permission can insert blocked dates" ON public.blocked_dates;
CREATE POLICY "Users with permission can insert blocked dates" ON public.blocked_dates FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_permission(auth.uid(), 'can_block_dates'::text));

DROP POLICY IF EXISTS "Users with permission can update blocked dates" ON public.blocked_dates;
CREATE POLICY "Users with permission can update blocked dates" ON public.blocked_dates FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_permission(auth.uid(), 'can_block_dates'::text));

-- blog_posts
DROP POLICY IF EXISTS "Admins can manage all blog posts" ON public.blog_posts;
CREATE POLICY "Admins can manage all blog posts" ON public.blog_posts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- booking_com_sync_log
DROP POLICY IF EXISTS "Admins can view sync logs" ON public.booking_com_sync_log;
CREATE POLICY "Admins can view sync logs" ON public.booking_com_sync_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- channel_markup_settings
DROP POLICY IF EXISTS "Admins can manage channel markup settings" ON public.channel_markup_settings;
CREATE POLICY "Admins can manage channel markup settings" ON public.channel_markup_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- channex_alerts
DROP POLICY IF EXISTS "Admins can manage channex alerts" ON public.channex_alerts;
CREATE POLICY "Admins can manage channex alerts" ON public.channex_alerts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- channex_bookings
DROP POLICY IF EXISTS "Admins can manage channex bookings" ON public.channex_bookings;
CREATE POLICY "Admins can manage channex bookings" ON public.channex_bookings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- channex_mappings
DROP POLICY IF EXISTS "Admins can manage channex mappings" ON public.channex_mappings;
CREATE POLICY "Admins can manage channex mappings" ON public.channex_mappings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- channex_property_config
DROP POLICY IF EXISTS "Admins can manage channex property config" ON public.channex_property_config;
CREATE POLICY "Admins can manage channex property config" ON public.channex_property_config FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- check_in_agreements
DROP POLICY IF EXISTS "Admins can manage all agreements" ON public.check_in_agreements;
CREATE POLICY "Admins can manage all agreements" ON public.check_in_agreements FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- companies
DROP POLICY IF EXISTS "Admins can manage all companies" ON public.companies;
CREATE POLICY "Admins can manage all companies" ON public.companies FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- derived_rate_plan_mappings
DROP POLICY IF EXISTS "Admins can manage derived rate plan mappings" ON public.derived_rate_plan_mappings;
CREATE POLICY "Admins can manage derived rate plan mappings" ON public.derived_rate_plan_mappings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- faq_items
DROP POLICY IF EXISTS "Admins can manage all FAQ items" ON public.faq_items;
CREATE POLICY "Admins can manage all FAQ items" ON public.faq_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- guest_accounts
DROP POLICY IF EXISTS "Admins can manage guest accounts" ON public.guest_accounts;
CREATE POLICY "Admins can manage guest accounts" ON public.guest_accounts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- guest_inventory_access
DROP POLICY IF EXISTS "Admins can manage inventory access" ON public.guest_inventory_access;
CREATE POLICY "Admins can manage inventory access" ON public.guest_inventory_access FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- guest_tickets
DROP POLICY IF EXISTS "Admins can manage all tickets" ON public.guest_tickets;
CREATE POLICY "Admins can manage all tickets" ON public.guest_tickets FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- housekeeping_logs
DROP POLICY IF EXISTS "Admins can manage all housekeeping logs" ON public.housekeeping_logs;
CREATE POLICY "Admins can manage all housekeeping logs" ON public.housekeeping_logs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- kyc_links
DROP POLICY IF EXISTS "Admins can manage KYC links" ON public.kyc_links;
CREATE POLICY "Admins can manage KYC links" ON public.kyc_links FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- media_library
DROP POLICY IF EXISTS "Admins can manage all media" ON public.media_library;
CREATE POLICY "Admins can manage all media" ON public.media_library FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- nearby_amenities
DROP POLICY IF EXISTS "Admins can manage nearby amenities" ON public.nearby_amenities;
CREATE POLICY "Admins can manage nearby amenities" ON public.nearby_amenities FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- notifications
DROP POLICY IF EXISTS "Admins and front desk can view all notifications" ON public.notifications;
CREATE POLICY "Admins and front desk can view all notifications" ON public.notifications FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'front_desk'::app_role));

-- properties (2 INSERT policies)
DROP POLICY IF EXISTS "Admins can create properties" ON public.properties;
CREATE POLICY "Admins can create properties" ON public.properties FOR INSERT
  WITH CHECK (is_system_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert properties" ON public.properties;
CREATE POLICY "Admins can insert properties" ON public.properties FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR is_system_admin(auth.uid()));

-- property_amenities
DROP POLICY IF EXISTS "Admins can manage property amenities" ON public.property_amenities;
CREATE POLICY "Admins can manage property amenities" ON public.property_amenities FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- rate_plan_prices (array role list)
DROP POLICY IF EXISTS "Rate plan prices manageable by admin and manager" ON public.rate_plan_prices;
CREATE POLICY "Rate plan prices manageable by admin and manager" ON public.rate_plan_prices FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (ARRAY['admin'::app_role, 'super_admin'::app_role, 'manager'::app_role])
  ));

-- rate_plan_value_adds (3)
DROP POLICY IF EXISTS "Admins and managers can delete value adds" ON public.rate_plan_value_adds;
CREATE POLICY "Admins and managers can delete value adds" ON public.rate_plan_value_adds FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

DROP POLICY IF EXISTS "Admins and managers can insert value adds" ON public.rate_plan_value_adds;
CREATE POLICY "Admins and managers can insert value adds" ON public.rate_plan_value_adds FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

DROP POLICY IF EXISTS "Admins and managers can update value adds" ON public.rate_plan_value_adds;
CREATE POLICY "Admins and managers can update value adds" ON public.rate_plan_value_adds FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- room_shuffle_log
DROP POLICY IF EXISTS "Admins can manage shuffle logs" ON public.room_shuffle_log;
CREATE POLICY "Admins can manage shuffle logs" ON public.room_shuffle_log FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- selection_accounts
DROP POLICY IF EXISTS "Admins can manage selection accounts" ON public.selection_accounts;
CREATE POLICY "Admins can manage selection accounts" ON public.selection_accounts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- slideshow_images (3)
DROP POLICY IF EXISTS "Admins can delete slideshow images" ON public.slideshow_images;
CREATE POLICY "Admins can delete slideshow images" ON public.slideshow_images FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert slideshow images" ON public.slideshow_images;
CREATE POLICY "Admins can insert slideshow images" ON public.slideshow_images FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admins can update slideshow images" ON public.slideshow_images;
CREATE POLICY "Admins can update slideshow images" ON public.slideshow_images FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- stay_surveys
DROP POLICY IF EXISTS "Admins can view all stay surveys" ON public.stay_surveys;
CREATE POLICY "Admins can view all stay surveys" ON public.stay_surveys FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- summary_report_log
DROP POLICY IF EXISTS "Admins can view report logs" ON public.summary_report_log;
CREATE POLICY "Admins can view report logs" ON public.summary_report_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- sync_logs
DROP POLICY IF EXISTS "Admins can view sync logs" ON public.sync_logs;
CREATE POLICY "Admins can view sync logs" ON public.sync_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- sync_status
DROP POLICY IF EXISTS "Admins can manage sync status" ON public.sync_status;
CREATE POLICY "Admins can manage sync status" ON public.sync_status FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ticket_surveys
DROP POLICY IF EXISTS "Admins can view all surveys" ON public.ticket_surveys;
CREATE POLICY "Admins can view all surveys" ON public.ticket_surveys FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- user_notification_settings
DROP POLICY IF EXISTS "Admins can manage all notification settings" ON public.user_notification_settings;
CREATE POLICY "Admins can manage all notification settings" ON public.user_notification_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- user_permissions
DROP POLICY IF EXISTS "Admins can manage user permissions" ON public.user_permissions;
CREATE POLICY "Admins can manage user permissions" ON public.user_permissions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- user_roles (4)
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
CREATE POLICY "Admins can view all user roles" ON public.user_roles FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- whatsapp_message_log
DROP POLICY IF EXISTS "Admins can manage message log" ON public.whatsapp_message_log;
CREATE POLICY "Admins can manage message log" ON public.whatsapp_message_log FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- whatsapp_message_templates
DROP POLICY IF EXISTS "Admins can manage message templates" ON public.whatsapp_message_templates;
CREATE POLICY "Admins can manage message templates" ON public.whatsapp_message_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));