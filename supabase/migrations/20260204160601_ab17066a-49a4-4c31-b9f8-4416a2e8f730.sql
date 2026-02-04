-- =============================================
-- CHANNEX INTEGRATION DATABASE STRUCTURE
-- =============================================

-- 1. Create channex_mappings table
CREATE TABLE public.channex_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  local_id uuid NOT NULL,
  channex_id text NOT NULL,
  channex_data jsonb,
  sync_status text NOT NULL DEFAULT 'pending',
  last_synced_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for channex_mappings
CREATE UNIQUE INDEX idx_channex_mappings_entity_local ON public.channex_mappings(entity_type, local_id);
CREATE UNIQUE INDEX idx_channex_mappings_entity_channex ON public.channex_mappings(entity_type, channex_id);
CREATE INDEX idx_channex_mappings_sync_status ON public.channex_mappings(sync_status);

-- Enable RLS
ALTER TABLE public.channex_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for channex_mappings
CREATE POLICY "Admins can manage channex mappings"
  ON public.channex_mappings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view channex mappings"
  ON public.channex_mappings
  FOR SELECT
  USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can update channex mappings"
  ON public.channex_mappings
  FOR UPDATE
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_channex_mappings_updated_at
  BEFORE UPDATE ON public.channex_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 2. Create channex_sync_logs table
-- =============================================
CREATE TABLE public.channex_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  endpoint text NOT NULL,
  request_payload jsonb,
  response_payload jsonb,
  status_code integer,
  success boolean NOT NULL,
  error_message text,
  property_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for property_id lookups
CREATE INDEX idx_channex_sync_logs_property ON public.channex_sync_logs(property_id);
CREATE INDEX idx_channex_sync_logs_created_at ON public.channex_sync_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.channex_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for channex_sync_logs
CREATE POLICY "Admins can view channex sync logs"
  ON public.channex_sync_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert channex sync logs"
  ON public.channex_sync_logs
  FOR INSERT
  WITH CHECK (true);

-- =============================================
-- 3. Create channex_bookings table
-- =============================================
CREATE TABLE public.channex_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channex_booking_id text NOT NULL UNIQUE,
  channex_revision_id text,
  ota_name text NOT NULL,
  ota_reservation_code text,
  property_id uuid NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  room_type_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  rate_plan_id uuid REFERENCES public.rate_plans(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new',
  guest_name text NOT NULL,
  guest_email text NOT NULL,
  guest_phone text,
  guest_country text,
  arrival_date date NOT NULL,
  departure_date date NOT NULL,
  adults integer NOT NULL DEFAULT 1,
  children integer NOT NULL DEFAULT 0,
  total_amount decimal(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  booking_data jsonb,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for channex_bookings
CREATE INDEX idx_channex_bookings_status ON public.channex_bookings(status);
CREATE INDEX idx_channex_bookings_acknowledged ON public.channex_bookings(acknowledged);
CREATE INDEX idx_channex_bookings_property ON public.channex_bookings(property_id);
CREATE INDEX idx_channex_bookings_arrival ON public.channex_bookings(arrival_date);

-- Enable RLS
ALTER TABLE public.channex_bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for channex_bookings
CREATE POLICY "Admins can manage channex bookings"
  ON public.channex_bookings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view channex bookings"
  ON public.channex_bookings
  FOR SELECT
  USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Front desk can view channex bookings"
  ON public.channex_bookings
  FOR SELECT
  USING (has_role(auth.uid(), 'front_desk'::app_role));

CREATE POLICY "System can insert channex bookings"
  ON public.channex_bookings
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update channex bookings"
  ON public.channex_bookings
  FOR UPDATE
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_channex_bookings_updated_at
  BEFORE UPDATE ON public.channex_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();