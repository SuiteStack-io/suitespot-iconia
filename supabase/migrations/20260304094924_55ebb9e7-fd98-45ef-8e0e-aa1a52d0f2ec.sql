
ALTER TABLE properties ADD COLUMN weekend_days integer[] DEFAULT '{4,5}';
ALTER TABLE properties ADD COLUMN off_peak_days integer[] DEFAULT '{}';
ALTER TABLE rate_plan_prices ADD COLUMN off_peak_rate numeric DEFAULT NULL;
