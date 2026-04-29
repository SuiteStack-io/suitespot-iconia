-- Promotional periods table
CREATE TABLE public.promotional_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  booking_window_start DATE NOT NULL,
  booking_window_end DATE NOT NULL,
  stay_start DATE NOT NULL,
  stay_end DATE NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value NUMERIC(10,2) NOT NULL,
  min_stay INTEGER DEFAULT NULL,
  room_types TEXT[] DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_booking_window CHECK (booking_window_end >= booking_window_start),
  CONSTRAINT valid_stay_window CHECK (stay_end >= stay_start)
);

ALTER TABLE public.promotional_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view promotional periods"
  ON public.promotional_periods
  FOR SELECT
  USING (true);

CREATE POLICY "Property managers can insert promotional periods"
  ON public.promotional_periods
  FOR INSERT
  TO authenticated
  WITH CHECK (user_has_property_access(property_id, 'manager'));

CREATE POLICY "Property managers can update promotional periods"
  ON public.promotional_periods
  FOR UPDATE
  TO authenticated
  USING (user_has_property_access(property_id, 'manager'));

CREATE POLICY "Property managers can delete promotional periods"
  ON public.promotional_periods
  FOR DELETE
  TO authenticated
  USING (user_has_property_access(property_id, 'manager'));

CREATE TRIGGER update_promotional_periods_updated_at
  BEFORE UPDATE ON public.promotional_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_promotional_periods_lookup
  ON public.promotional_periods (property_id, is_active, stay_start, stay_end);

-- Track applied promotion in pricing_log
ALTER TABLE public.pricing_log
  ADD COLUMN promotion_id UUID REFERENCES public.promotional_periods(id),
  ADD COLUMN promotion_discount_percent NUMERIC(5,2);
