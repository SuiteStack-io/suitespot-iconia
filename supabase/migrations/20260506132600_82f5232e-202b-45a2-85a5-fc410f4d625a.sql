ALTER TABLE public.promotional_periods
  ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX idx_promotional_periods_active_lookup
  ON public.promotional_periods (property_id, deleted_at, is_active, stay_start, stay_end);