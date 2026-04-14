ALTER TABLE rate_plan_restrictions ALTER COLUMN min_stay_arrival DROP DEFAULT;
ALTER TABLE rate_plan_restrictions ALTER COLUMN min_stay_through DROP DEFAULT;
ALTER TABLE rate_plan_restrictions ALTER COLUMN stop_sell DROP DEFAULT;
ALTER TABLE rate_plan_restrictions ALTER COLUMN closed_to_arrival DROP DEFAULT;
ALTER TABLE rate_plan_restrictions ALTER COLUMN closed_to_departure DROP DEFAULT;