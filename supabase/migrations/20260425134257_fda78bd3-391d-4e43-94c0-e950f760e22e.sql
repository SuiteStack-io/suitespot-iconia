ALTER TABLE public.properties
  ADD COLUMN revenue_recognition_method text NOT NULL DEFAULT 'check_in'
  CHECK (revenue_recognition_method IN ('check_in', 'check_out', 'prorata'));