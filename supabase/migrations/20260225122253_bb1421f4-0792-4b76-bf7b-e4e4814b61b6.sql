
ALTER TABLE rate_plan_restrictions RENAME COLUMN min_stay TO min_stay_through;
ALTER TABLE rate_plan_restrictions ADD COLUMN min_stay_arrival INTEGER DEFAULT 1;

ALTER TABLE rate_plans RENAME COLUMN default_min_stay TO default_min_stay_through;
ALTER TABLE rate_plans ADD COLUMN default_min_stay_arrival INTEGER DEFAULT 1;
