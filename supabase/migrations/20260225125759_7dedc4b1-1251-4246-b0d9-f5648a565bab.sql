
-- 1. Add is_system_admin to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_system_admin BOOLEAN DEFAULT FALSE;

-- 2. Create properties table
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  description TEXT,
  property_type TEXT DEFAULT 'hotel',
  email TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  address TEXT NOT NULL,
  address_line_2 TEXT,
  city TEXT NOT NULL,
  state TEXT,
  zip_code TEXT,
  country TEXT NOT NULL DEFAULT 'EG',
  latitude NUMERIC(10,8),
  longitude NUMERIC(11,8),
  timezone TEXT NOT NULL DEFAULT 'Africa/Cairo',
  currency TEXT NOT NULL DEFAULT 'USD',
  default_checkin_time TIME DEFAULT '15:00',
  default_checkout_time TIME DEFAULT '11:00',
  channex_property_id TEXT,
  channex_synced BOOLEAN DEFAULT FALSE,
  channex_last_sync TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

CREATE UNIQUE INDEX idx_properties_single_default ON properties (is_default) WHERE is_default = TRUE;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- 3. Create user_property_access table
CREATE TABLE public.user_property_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer',
  granted_by UUID REFERENCES public.profiles(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, property_id)
);

CREATE INDEX idx_upa_user ON user_property_access(user_id);
CREATE INDEX idx_upa_property ON user_property_access(property_id);
ALTER TABLE public.user_property_access ENABLE ROW LEVEL SECURITY;

-- 4. Security definer helpers to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_system_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_system_admin FROM public.profiles WHERE id = _user_id),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.has_property_role(_user_id uuid, _property_id uuid, _roles text[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_property_access
    WHERE user_id = _user_id
      AND property_id = _property_id
      AND role = ANY(_roles)
  )
$$;

CREATE OR REPLACE FUNCTION public.has_property_access(_user_id uuid, _property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_property_access
    WHERE user_id = _user_id
      AND property_id = _property_id
  )
$$;

-- 5. RLS on properties
CREATE POLICY "Users can view assigned properties" ON public.properties
  FOR SELECT TO authenticated
  USING (
    public.has_property_access(auth.uid(), id)
    OR public.is_system_admin(auth.uid())
  );

CREATE POLICY "Admins can insert properties" ON public.properties
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_system_admin(auth.uid())
  );

CREATE POLICY "Property owners and admins can update" ON public.properties
  FOR UPDATE TO authenticated
  USING (
    public.has_property_role(auth.uid(), id, ARRAY['owner', 'admin'])
    OR public.is_system_admin(auth.uid())
  );

CREATE POLICY "Property owners can delete" ON public.properties
  FOR DELETE TO authenticated
  USING (
    public.has_property_role(auth.uid(), id, ARRAY['owner'])
    OR public.is_system_admin(auth.uid())
  );

-- 6. RLS on user_property_access
CREATE POLICY "Users can view their property access" ON public.user_property_access
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_property_role(auth.uid(), property_id, ARRAY['owner', 'admin'])
    OR public.is_system_admin(auth.uid())
  );

CREATE POLICY "Property owners/admins can insert access" ON public.user_property_access
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_property_role(auth.uid(), property_id, ARRAY['owner', 'admin'])
    OR public.is_system_admin(auth.uid())
  );

CREATE POLICY "Property owners/admins can update access" ON public.user_property_access
  FOR UPDATE TO authenticated
  USING (
    public.has_property_role(auth.uid(), property_id, ARRAY['owner', 'admin'])
    OR public.is_system_admin(auth.uid())
  );

CREATE POLICY "Property owners/admins can delete access" ON public.user_property_access
  FOR DELETE TO authenticated
  USING (
    public.has_property_role(auth.uid(), property_id, ARRAY['owner', 'admin'])
    OR public.is_system_admin(auth.uid())
  );

-- 7. Auto-assign creator as owner trigger
CREATE OR REPLACE FUNCTION public.auto_assign_property_owner()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.user_property_access (user_id, property_id, role, granted_by)
    VALUES (NEW.created_by, NEW.id, 'owner', NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_auto_assign_property_owner
  AFTER INSERT ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_property_owner();

-- 8. Ensure single default property trigger
CREATE OR REPLACE FUNCTION public.ensure_single_default_property()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    UPDATE public.properties SET is_default = FALSE WHERE id != NEW.id AND is_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_ensure_single_default_property
  BEFORE INSERT OR UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_default_property();

-- 9. Updated_at trigger for properties
CREATE TRIGGER trigger_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
