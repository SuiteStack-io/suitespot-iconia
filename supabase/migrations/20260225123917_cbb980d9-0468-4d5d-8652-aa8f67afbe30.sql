
ALTER TABLE rate_plans ALTER COLUMN default_min_stay_arrival DROP DEFAULT;
ALTER TABLE rate_plans ALTER COLUMN default_min_stay_arrival TYPE INTEGER[] USING ARRAY[COALESCE(default_min_stay_arrival,1), COALESCE(default_min_stay_arrival,1), COALESCE(default_min_stay_arrival,1), COALESCE(default_min_stay_arrival,1), COALESCE(default_min_stay_arrival,1), COALESCE(default_min_stay_arrival,1), COALESCE(default_min_stay_arrival,1)];
ALTER TABLE rate_plans ALTER COLUMN default_min_stay_arrival SET DEFAULT '{1,1,1,1,1,1,1}';

ALTER TABLE rate_plans ALTER COLUMN default_min_stay_through DROP DEFAULT;
ALTER TABLE rate_plans ALTER COLUMN default_min_stay_through TYPE INTEGER[] USING ARRAY[COALESCE(default_min_stay_through,1), COALESCE(default_min_stay_through,1), COALESCE(default_min_stay_through,1), COALESCE(default_min_stay_through,1), COALESCE(default_min_stay_through,1), COALESCE(default_min_stay_through,1), COALESCE(default_min_stay_through,1)];
ALTER TABLE rate_plans ALTER COLUMN default_min_stay_through SET DEFAULT '{1,1,1,1,1,1,1}';
