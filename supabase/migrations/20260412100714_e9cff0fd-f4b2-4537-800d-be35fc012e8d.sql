
-- Part 1: Add min_rate and max_rate to rate_plan_prices
ALTER TABLE public.rate_plan_prices
  ADD COLUMN IF NOT EXISTS min_rate NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_rate NUMERIC(10,2) DEFAULT NULL;

-- Part 2: Create pricing_rules table
CREATE TABLE public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  day_of_week_multipliers JSONB NOT NULL DEFAULT '{"0":0.95,"1":0.95,"2":0.93,"3":0.95,"4":1.00,"5":1.10,"6":1.15}',
  occupancy_thresholds JSONB NOT NULL DEFAULT '[30,50,65,75,85,92]',
  occupancy_adjustments JSONB NOT NULL DEFAULT '[0,5,10,18,28,40,55]',
  pace_index_bump_threshold NUMERIC(4,2) NOT NULL DEFAULT 1.30,
  monthly_revenue_target NUMERIC(12,2) DEFAULT NULL,
  monthly_revenue_stretch NUMERIC(12,2) DEFAULT NULL,
  revenue_thresholds JSONB NOT NULL DEFAULT '[40,60,80,95,100,120]',
  revenue_adjustments_phase_a JSONB NOT NULL DEFAULT '[0,0,5,5,10,10,10]',
  revenue_adjustments_phase_b JSONB NOT NULL DEFAULT '[0,0,5,10,15,20,25]',
  revenue_occupancy_conflict_revenue_min NUMERIC(5,2) NOT NULL DEFAULT 80,
  revenue_occupancy_conflict_occupancy_max NUMERIC(5,2) NOT NULL DEFAULT 40,
  revenue_occupancy_conflict_cap NUMERIC(5,2) NOT NULL DEFAULT 5,
  last_minute_strategy TEXT NOT NULL DEFAULT 'discount',
  channex_min_price_synced BOOLEAN NOT NULL DEFAULT false,
  channex_max_price_synced BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id),
  CONSTRAINT pricing_rules_last_minute_strategy_check CHECK (last_minute_strategy IN ('discount', 'premium'))
);

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pricing rules"
  ON public.pricing_rules FOR SELECT
  USING (true);

CREATE POLICY "Property managers can insert pricing rules"
  ON public.pricing_rules FOR INSERT
  TO authenticated
  WITH CHECK (user_has_property_access(property_id, 'manager'));

CREATE POLICY "Property managers can update pricing rules"
  ON public.pricing_rules FOR UPDATE
  TO authenticated
  USING (user_has_property_access(property_id, 'manager'));

CREATE POLICY "Property managers can delete pricing rules"
  ON public.pricing_rules FOR DELETE
  TO authenticated
  USING (user_has_property_access(property_id, 'manager'));

CREATE TRIGGER update_pricing_rules_updated_at
  BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Part 3: Create pricing_overrides table
CREATE TABLE public.pricing_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  override_type TEXT NOT NULL DEFAULT 'fixed_rate',
  value NUMERIC(10,2) NOT NULL,
  reason TEXT,
  room_type TEXT DEFAULT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id, override_date, room_type),
  CONSTRAINT pricing_overrides_type_check CHECK (override_type IN ('fixed_rate', 'percentage_adjustment', 'multiplier'))
);

CREATE UNIQUE INDEX pricing_overrides_unique_all_rooms
  ON public.pricing_overrides (property_id, override_date)
  WHERE room_type IS NULL;

ALTER TABLE public.pricing_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pricing overrides"
  ON public.pricing_overrides FOR SELECT
  USING (true);

CREATE POLICY "Property managers can insert pricing overrides"
  ON public.pricing_overrides FOR INSERT
  TO authenticated
  WITH CHECK (user_has_property_access(property_id, 'manager'));

CREATE POLICY "Property managers can update pricing overrides"
  ON public.pricing_overrides FOR UPDATE
  TO authenticated
  USING (user_has_property_access(property_id, 'manager'));

CREATE POLICY "Property managers can delete pricing overrides"
  ON public.pricing_overrides FOR DELETE
  TO authenticated
  USING (user_has_property_access(property_id, 'manager'));

-- Part 4: Create pricing_log table
CREATE TABLE public.pricing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  date_priced DATE NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  target_month TEXT NOT NULL,
  month_phase TEXT NOT NULL,
  room_type TEXT,
  rate_plan_id UUID REFERENCES public.rate_plans(id),
  base_rate NUMERIC(10,2),
  occupancy_percent NUMERIC(5,2),
  pace_index NUMERIC(5,2),
  occupancy_tier INTEGER,
  occupancy_adjustment_percent NUMERIC(5,2),
  revenue_total NUMERIC(12,2),
  revenue_achievement_percent NUMERIC(5,2),
  revenue_adjustment_percent NUMERIC(5,2),
  day_of_week_multiplier NUMERIC(4,2),
  lead_time_days INTEGER,
  lead_time_adjustment_percent NUMERIC(5,2),
  orphan_status TEXT DEFAULT 'none',
  orphan_modifier NUMERIC(4,2) DEFAULT 1.00,
  room_type_min_rate NUMERIC(10,2),
  room_type_max_rate NUMERIC(10,2),
  calculated_rate NUMERIC(10,2),
  final_rate NUMERIC(10,2),
  was_clamped BOOLEAN DEFAULT false,
  clamp_direction TEXT,
  override_active BOOLEAN DEFAULT false,
  override_id UUID REFERENCES public.pricing_overrides(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pricing_log_month_phase_check CHECK (month_phase IN ('A', 'B')),
  CONSTRAINT pricing_log_orphan_status_check CHECK (orphan_status IN ('none', '1_night', '2_night')),
  CONSTRAINT pricing_log_clamp_direction_check CHECK (clamp_direction IN ('floor', 'ceiling') OR clamp_direction IS NULL)
);

CREATE INDEX idx_pricing_log_property_date ON public.pricing_log (property_id, date_priced);
CREATE INDEX idx_pricing_log_property_calculated ON public.pricing_log (property_id, calculated_at);

ALTER TABLE public.pricing_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pricing logs"
  ON public.pricing_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert pricing logs"
  ON public.pricing_log FOR INSERT
  WITH CHECK (true);

-- Part 5: Backfill default pricing_rules for existing properties
INSERT INTO public.pricing_rules (property_id, is_enabled)
SELECT id, false FROM public.properties
WHERE id NOT IN (SELECT property_id FROM public.pricing_rules);
