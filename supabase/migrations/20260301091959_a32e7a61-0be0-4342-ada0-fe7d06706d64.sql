
-- Phase 4: Property-scoped RLS policies

-- Step 1: Create role-hierarchy helper function
CREATE OR REPLACE FUNCTION public.user_has_property_access(
  property_uuid UUID,
  required_role TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF is_system_admin(auth.uid()) THEN RETURN TRUE; END IF;
  IF required_role IS NULL THEN
    RETURN has_property_access(auth.uid(), property_uuid);
  END IF;
  RETURN has_property_role(auth.uid(), property_uuid,
    CASE required_role
      WHEN 'viewer' THEN ARRAY['owner','admin','manager','staff','viewer']
      WHEN 'staff' THEN ARRAY['owner','admin','manager','staff']
      WHEN 'manager' THEN ARRAY['owner','admin','manager']
      WHEN 'admin' THEN ARRAY['owner','admin']
      WHEN 'owner' THEN ARRAY['owner']
    END
  );
END;
$$;

-- Step 2: Update units RLS policies
DROP POLICY IF EXISTS "Admins can manage units" ON units;
DROP POLICY IF EXISTS "Anyone can view available units" ON units;
DROP POLICY IF EXISTS "Authenticated users can view units" ON units;

CREATE POLICY "Public can view units" ON units
  FOR SELECT USING (true);

CREATE POLICY "Property managers can insert units" ON units
  FOR INSERT TO authenticated
  WITH CHECK (user_has_property_access(property_id, 'manager'));

CREATE POLICY "Property managers can update units" ON units
  FOR UPDATE TO authenticated
  USING (user_has_property_access(property_id, 'manager'));

CREATE POLICY "Property managers can delete units" ON units
  FOR DELETE TO authenticated
  USING (user_has_property_access(property_id, 'manager'));

-- Step 3: Update reservations RLS policies
DROP POLICY IF EXISTS "Authenticated users can view reservations" ON reservations;
DROP POLICY IF EXISTS "Admins and managers can insert reservations" ON reservations;
DROP POLICY IF EXISTS "Users with permissions can update reservations" ON reservations;
DROP POLICY IF EXISTS "Admins can delete reservations" ON reservations;
-- Keep public access policies:
-- "Allow public access to reservations for guest check-in" (SELECT confirmed/checked-in)
-- "Anyone can view reservation dates for availability" (SELECT confirmed)
-- "Allow public website bookings" (INSERT direct website)

CREATE POLICY "Property users can view reservations" ON reservations
  FOR SELECT TO authenticated
  USING (user_has_property_access(property_id) OR property_id IS NULL);

CREATE POLICY "Property staff can insert reservations" ON reservations
  FOR INSERT TO authenticated
  WITH CHECK (user_has_property_access(property_id, 'staff') OR property_id IS NULL);

CREATE POLICY "Property staff can update reservations" ON reservations
  FOR UPDATE TO authenticated
  USING (
    user_has_property_access(property_id, 'staff')
    OR property_id IS NULL
    OR has_permission(auth.uid(), 'can_check_in')
    OR has_permission(auth.uid(), 'can_check_out')
  );

CREATE POLICY "Property admins can delete reservations" ON reservations
  FOR DELETE TO authenticated
  USING (user_has_property_access(property_id, 'admin') OR property_id IS NULL);

-- Step 4: Update rate_plans RLS policies
DROP POLICY IF EXISTS "Rate plans manageable by admin and manager" ON rate_plans;
DROP POLICY IF EXISTS "Rate plans viewable by authenticated users" ON rate_plans;

CREATE POLICY "Rate plans viewable publicly" ON rate_plans
  FOR SELECT USING (true);

CREATE POLICY "Property managers can manage rate plans" ON rate_plans
  FOR INSERT TO authenticated
  WITH CHECK (user_has_property_access(property_id, 'manager'));

CREATE POLICY "Property managers can update rate plans" ON rate_plans
  FOR UPDATE TO authenticated
  USING (user_has_property_access(property_id, 'manager'));

CREATE POLICY "Property managers can delete rate plans" ON rate_plans
  FOR DELETE TO authenticated
  USING (user_has_property_access(property_id, 'manager'));

-- Step 5: Update rate_plan_restrictions RLS policies
DROP POLICY IF EXISTS "Admins and managers can manage restrictions" ON rate_plan_restrictions;
DROP POLICY IF EXISTS "Authenticated users can view restrictions" ON rate_plan_restrictions;

CREATE POLICY "Rate plan restrictions viewable publicly" ON rate_plan_restrictions
  FOR SELECT USING (true);

CREATE POLICY "Property managers can insert restrictions" ON rate_plan_restrictions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM rate_plans WHERE rate_plans.id = rate_plan_id
    AND user_has_property_access(rate_plans.property_id, 'manager')
  ));

CREATE POLICY "Property managers can update restrictions" ON rate_plan_restrictions
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM rate_plans WHERE rate_plans.id = rate_plan_id
    AND user_has_property_access(rate_plans.property_id, 'manager')
  ));

CREATE POLICY "Property managers can delete restrictions" ON rate_plan_restrictions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM rate_plans WHERE rate_plans.id = rate_plan_id
    AND user_has_property_access(rate_plans.property_id, 'manager')
  ));

-- Step 6: Update channex_sync_logs RLS policies
DROP POLICY IF EXISTS "Admins can view channex sync logs" ON channex_sync_logs;
DROP POLICY IF EXISTS "Admins can delete channex sync logs" ON channex_sync_logs;

CREATE POLICY "Property users can view channex sync logs" ON channex_sync_logs
  FOR SELECT TO authenticated
  USING (user_has_property_access(property_id) OR property_id IS NULL);

CREATE POLICY "Property admins can delete channex sync logs" ON channex_sync_logs
  FOR DELETE TO authenticated
  USING (user_has_property_access(property_id, 'admin') OR property_id IS NULL);
