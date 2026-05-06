ALTER TABLE public.pricing_rules
  ADD COLUMN IF NOT EXISTS aggression_level INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS base_tiers JSONB;

UPDATE public.pricing_rules
SET base_tiers = jsonb_build_object(
  'occupancy_adjustments', to_jsonb(occupancy_adjustments),
  'revenue_adjustments_phase_a', to_jsonb(revenue_adjustments_phase_a),
  'revenue_adjustments_phase_b', to_jsonb(revenue_adjustments_phase_b),
  'pace_index_bump_threshold', to_jsonb(pace_index_bump_threshold)
)
WHERE base_tiers IS NULL;