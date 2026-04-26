ALTER TABLE public.properties
  ADD COLUMN occupancy_target_annual numeric NULL
  CHECK (occupancy_target_annual IS NULL OR (occupancy_target_annual >= 0 AND occupancy_target_annual <= 100));