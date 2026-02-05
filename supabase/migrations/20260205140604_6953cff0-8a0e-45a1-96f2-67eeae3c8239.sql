-- Add Channex rate plan fields to rate_plans table
ALTER TABLE rate_plans 
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES channex_mappings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS sell_mode text DEFAULT 'per_room',
  ADD COLUMN IF NOT EXISTS extra_adult_rate numeric DEFAULT 50,
  ADD COLUMN IF NOT EXISTS extra_child_rate numeric DEFAULT 0;

-- Add check constraint for sell_mode (using DO block to check if constraint exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rate_plans_sell_mode_check'
  ) THEN
    ALTER TABLE rate_plans 
      ADD CONSTRAINT rate_plans_sell_mode_check 
      CHECK (sell_mode IN ('per_room', 'per_person'));
  END IF;
END $$;

-- Add occupancy columns to rate_plan_prices
ALTER TABLE rate_plan_prices 
  ADD COLUMN IF NOT EXISTS base_occupancy integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS max_occupancy integer;