-- Create user_permissions table
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_check_in boolean DEFAULT false,
  can_check_out boolean DEFAULT false,
  can_submit_forms boolean DEFAULT false,
  can_create_booking boolean DEFAULT false,
  can_change_rooms boolean DEFAULT false,
  can_block_dates boolean DEFAULT false,
  can_export_calendar boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can manage all permissions
CREATE POLICY "Admins can manage user permissions"
ON public.user_permissions FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own permissions
CREATE POLICY "Users can view own permissions"
ON public.user_permissions FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Create function to check user permission (admins always have all permissions)
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result boolean;
BEGIN
  -- Admins always have all permissions
  IF has_role(_user_id, 'admin'::app_role) THEN
    RETURN true;
  END IF;
  
  -- Check specific permission dynamically
  EXECUTE format(
    'SELECT %I FROM user_permissions WHERE user_id = $1',
    _permission
  ) INTO v_result USING _user_id;
  
  RETURN COALESCE(v_result, false);
END;
$$;

-- Update reservations UPDATE policy to include permission checks
DROP POLICY IF EXISTS "Admins, managers, and front desk can update reservations" ON public.reservations;

CREATE POLICY "Users with permissions can update reservations"
ON public.reservations FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_permission(auth.uid(), 'can_check_in') OR
  has_permission(auth.uid(), 'can_check_out')
);

-- Update blocked_dates INSERT policy
DROP POLICY IF EXISTS "Admins can insert blocked dates" ON public.blocked_dates;
CREATE POLICY "Users with permission can insert blocked dates"
ON public.blocked_dates FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_permission(auth.uid(), 'can_block_dates')
);

-- Update blocked_dates DELETE policy
DROP POLICY IF EXISTS "Admins can delete blocked dates" ON public.blocked_dates;
CREATE POLICY "Users with permission can delete blocked dates"
ON public.blocked_dates FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_permission(auth.uid(), 'can_block_dates')
);

-- Update blocked_dates UPDATE policy
DROP POLICY IF EXISTS "Admins can update blocked dates" ON public.blocked_dates;
CREATE POLICY "Users with permission can update blocked dates"
ON public.blocked_dates FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_permission(auth.uid(), 'can_block_dates')
);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();