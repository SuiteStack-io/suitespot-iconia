-- Add unit_id column to rate_plan_prices for per-room pricing overrides
ALTER TABLE public.rate_plan_prices 
ADD COLUMN unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE;

-- Create index for efficient lookups
CREATE INDEX idx_rate_plan_prices_unit ON public.rate_plan_prices(unit_id);

-- Add comment for documentation
COMMENT ON COLUMN public.rate_plan_prices.unit_id IS 'When NULL, price applies to entire room type. When set, price applies to this specific unit only.';