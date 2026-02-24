
-- New table for date-specific restrictions
CREATE TABLE public.rate_plan_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_plan_id UUID NOT NULL REFERENCES public.rate_plans(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  min_stay INTEGER DEFAULT 1,
  max_stay INTEGER,
  stop_sell BOOLEAN DEFAULT FALSE,
  closed_to_arrival BOOLEAN DEFAULT FALSE,
  closed_to_departure BOOLEAN DEFAULT FALSE,
  synced_to_channex BOOLEAN DEFAULT FALSE,
  channex_task_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_restrictions_rate_plan ON public.rate_plan_restrictions(rate_plan_id);
CREATE INDEX idx_restrictions_dates ON public.rate_plan_restrictions(date_from, date_to);

-- Enable RLS
ALTER TABLE public.rate_plan_restrictions ENABLE ROW LEVEL SECURITY;

-- Admins/managers can manage
CREATE POLICY "Admins and managers can manage restrictions"
  ON public.rate_plan_restrictions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Authenticated users can view
CREATE POLICY "Authenticated users can view restrictions"
  ON public.rate_plan_restrictions FOR SELECT
  USING (true);

-- Default restriction columns on rate_plans
ALTER TABLE public.rate_plans
  ADD COLUMN IF NOT EXISTS default_min_stay INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS default_max_stay INTEGER,
  ADD COLUMN IF NOT EXISTS default_stop_sell BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS default_closed_to_arrival BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS default_closed_to_departure BOOLEAN DEFAULT FALSE;

-- Updated_at trigger
CREATE TRIGGER update_rate_plan_restrictions_updated_at
  BEFORE UPDATE ON public.rate_plan_restrictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
