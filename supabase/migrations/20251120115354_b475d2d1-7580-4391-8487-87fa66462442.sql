-- Create enums for guest tickets
CREATE TYPE ticket_type AS ENUM ('not_working', 'broken', 'repair_needed', 'housekeeping', 'linen_change');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- Create guest_accounts table
CREATE TABLE public.guest_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE CASCADE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  first_login_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES public.profiles(id)
);

-- Create property_amenities table
CREATE TABLE public.property_amenities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  is_available BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create guest_tickets table
CREATE TABLE public.guest_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE CASCADE NOT NULL,
  guest_account_id UUID REFERENCES public.guest_accounts(id) ON DELETE CASCADE NOT NULL,
  ticket_type ticket_type NOT NULL,
  priority ticket_priority NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  amenity_id UUID REFERENCES public.property_amenities(id),
  status ticket_status NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id),
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create nearby_amenities table
CREATE TABLE public.nearby_amenities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  distance_meters INTEGER NOT NULL,
  address TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  phone TEXT,
  website TEXT,
  hours TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add location fields to units table
ALTER TABLE public.units 
ADD COLUMN IF NOT EXISTS latitude NUMERIC,
ADD COLUMN IF NOT EXISTS longitude NUMERIC,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS map_description TEXT;

-- Create indexes for better performance
CREATE INDEX idx_guest_accounts_reservation ON guest_accounts(reservation_id);
CREATE INDEX idx_guest_accounts_username ON guest_accounts(username);
CREATE INDEX idx_property_amenities_unit ON property_amenities(unit_id);
CREATE INDEX idx_guest_tickets_reservation ON guest_tickets(reservation_id);
CREATE INDEX idx_guest_tickets_guest_account ON guest_tickets(guest_account_id);
CREATE INDEX idx_guest_tickets_status ON guest_tickets(status);
CREATE INDEX idx_guest_tickets_created_at ON guest_tickets(created_at DESC);
CREATE INDEX idx_nearby_amenities_unit ON nearby_amenities(unit_id);

-- Enable RLS on all tables
ALTER TABLE public.guest_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nearby_amenities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for guest_accounts
CREATE POLICY "Admins can manage guest accounts"
ON public.guest_accounts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert guest accounts"
ON public.guest_accounts
FOR INSERT
WITH CHECK (true);

-- RLS Policies for property_amenities
CREATE POLICY "Admins can manage property amenities"
ON public.property_amenities
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view property amenities"
ON public.property_amenities
FOR SELECT
USING (true);

-- RLS Policies for guest_tickets
CREATE POLICY "Admins can manage all tickets"
ON public.guest_tickets
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view all tickets"
ON public.guest_tickets
FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "System can insert tickets"
ON public.guest_tickets
FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update tickets"
ON public.guest_tickets
FOR UPDATE
USING (true);

-- RLS Policies for nearby_amenities
CREATE POLICY "Admins can manage nearby amenities"
ON public.nearby_amenities
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view nearby amenities"
ON public.nearby_amenities
FOR SELECT
USING (true);

-- Create trigger for updated_at on guest_tickets
CREATE TRIGGER update_guest_tickets_updated_at
BEFORE UPDATE ON public.guest_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for guest_tickets table
ALTER PUBLICATION supabase_realtime ADD TABLE public.guest_tickets;