-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'front_desk', 'housekeeping');

-- Create user_roles table (separate from profiles to prevent privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create units table (rooms 101-105)
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view units"
  ON public.units FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage units"
  ON public.units FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create reservations table
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL DEFAULT 'Booking.com',
  booking_reference TEXT NOT NULL UNIQUE,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  nights INTEGER GENERATED ALWAYS AS (check_out_date - check_in_date) STORED,
  number_of_guests INTEGER NOT NULL,
  guest_names TEXT[] NOT NULL DEFAULT '{}',
  guest_nationality TEXT,
  guest_ages INTEGER[] DEFAULT '{}',
  contact_email TEXT,
  contact_phone TEXT,
  total_price NUMERIC(10,2),
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('Upcoming', 'In-House', 'Checked-Out', 'Cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_dates CHECK (check_out_date > check_in_date),
  CONSTRAINT valid_guest_count CHECK (number_of_guests > 0)
);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reservations"
  ON public.reservations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and front desk can update reservations"
  ON public.reservations FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'front_desk')
  );

CREATE POLICY "Admins and front desk can insert reservations"
  ON public.reservations FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'front_desk')
  );

CREATE POLICY "Admins can delete reservations"
  ON public.reservations FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  changes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_units_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to log reservation changes
CREATE OR REPLACE FUNCTION public.log_reservation_changes()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, changes)
    VALUES (
      auth.uid(),
      'UPDATE',
      'reservations',
      NEW.id,
      jsonb_build_object(
        'old', to_jsonb(OLD),
        'new', to_jsonb(NEW)
      )
    );
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, changes)
    VALUES (
      auth.uid(),
      'INSERT',
      'reservations',
      NEW.id,
      to_jsonb(NEW)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_reservation_changes_trigger
  AFTER INSERT OR UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.log_reservation_changes();

-- Insert seed units (101-105)
INSERT INTO public.units (name, status) VALUES
  ('101', 'Active'),
  ('102', 'Active'),
  ('103', 'Active'),
  ('104', 'Active'),
  ('105', 'Active');

-- Insert seed reservations
INSERT INTO public.reservations (
  booking_reference, 
  unit_id, 
  check_in_date, 
  check_out_date, 
  number_of_guests, 
  guest_names, 
  guest_nationality, 
  guest_ages,
  contact_email,
  total_price,
  currency,
  status
) VALUES
  (
    'BK-1001',
    (SELECT id FROM public.units WHERE name = '101'),
    '2025-10-12',
    '2025-10-15',
    2,
    ARRAY['Ali Hassan', 'Maya Farouk'],
    'EG',
    ARRAY[34, 31],
    'ali.hassan@example.com',
    450.00,
    'USD',
    'Upcoming'
  ),
  (
    'BK-1002',
    (SELECT id FROM public.units WHERE name = '102'),
    '2025-10-14',
    '2025-10-16',
    1,
    ARRAY['Jon Park'],
    'US',
    ARRAY[29],
    'jon.park@example.com',
    280.00,
    'USD',
    'Upcoming'
  ),
  (
    'BK-1003',
    (SELECT id FROM public.units WHERE name = '103'),
    '2025-10-15',
    '2025-10-18',
    3,
    ARRAY['Sara N.', 'Omar N.', 'Child'],
    'AE',
    ARRAY[36, 38, 7],
    'sara.omar@example.com',
    720.00,
    'USD',
    'Upcoming'
  );