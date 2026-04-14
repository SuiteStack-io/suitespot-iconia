

## Remove DEFAULT Constraints from rate_plan_restrictions

### Database Migration

Run a single migration to drop DEFAULT values from 5 columns:

```sql
ALTER TABLE rate_plan_restrictions ALTER COLUMN min_stay_arrival DROP DEFAULT;
ALTER TABLE rate_plan_restrictions ALTER COLUMN min_stay_through DROP DEFAULT;
ALTER TABLE rate_plan_restrictions ALTER COLUMN stop_sell DROP DEFAULT;
ALTER TABLE rate_plan_restrictions ALTER COLUMN closed_to_arrival DROP DEFAULT;
ALTER TABLE rate_plan_restrictions ALTER COLUMN closed_to_departure DROP DEFAULT;
```

### No Code Changes

The editor and edge function already handle NULLs correctly. Only the database schema needs updating.

