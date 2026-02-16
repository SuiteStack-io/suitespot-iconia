

## Daily Full Sync to Channex

### Purpose
A scheduled backup function that runs once daily at 3:00 AM Cairo time to push all availability and rates to Channex for the next 365 days. This ensures Channex always has accurate data even if some real-time trigger-based updates failed.

### New Files

#### 1. Edge Function: `supabase/functions/channex-daily-sync/index.ts`

No user authentication required (called by cron). Uses service role key.

**Logic flow:**

1. Fetch all `channex_mappings` where `entity_type = 'property'` and `sync_status = 'synced'`
2. For each property:
   - Fetch all room type mappings (`entity_type = 'room_type'`, `sync_status = 'synced'`)
   - Fetch all rate plan mappings (`entity_type = 'rate_plan'`, `sync_status = 'synced'`)
   - **Availability sync**: For each room type, calculate availability day-by-day for the next 365 days. Group into contiguous date ranges with the same availability count to minimize API calls. Push to Channex `/api/v1/availability` in batches of 10 values per request, with a 6-second delay between batches (respecting 10 requests/minute limit).
   - **Rate sync**: For each rate plan, fetch `rate_plan_prices` rows. Build date ranges from `valid_from`/`valid_to` on the rate plan. Push to Channex `/api/v1/restrictions` in batches of 10 values per request, with 6-second delays.
3. If any property fails, continue with the next. Collect all errors.
4. Log a summary to `channex_sync_logs` with function name `channex-daily-sync`.
5. Return a JSON summary: properties synced, availability values pushed, rate values pushed, errors.

**Availability calculation** (reuses the same logic as `channex-process-sync-queue`):
- For each room type (`booking_com_name`), for each date in the 365-day window:
  - Total units of that room type (not in maintenance)
  - Minus confirmed/checked-in reservations overlapping that date
  - Minus blocked dates on that date
- Consecutive dates with the same availability are collapsed into a single range to reduce API calls.

**Rate calculation**:
- For each mapped rate plan, fetch `rate_plan_prices` rows (which have `weekday_rate`, `weekend_rate`, `room_type`)
- Use `valid_from`/`valid_to` from the `rate_plans` table, defaulting to today through today+365
- Convert rates to cents with `Math.round(rate * 100)`
- Push as restrictions to Channex

**Rate limiting strategy**:
- Batch size: 10 values per API call
- Delay between batches: 6 seconds (ensures max 10 calls/minute)
- Separate counters for availability and rate calls per property

#### 2. Config: Update `supabase/config.toml`

Add:
```text
[functions.channex-daily-sync]
verify_jwt = false
```

### Cron Job Setup

After the function is deployed, a SQL statement will be provided for you to run to schedule the cron job:

```text
-- Runs daily at 1:00 AM UTC = 3:00 AM Cairo time (UTC+2)
SELECT cron.schedule(
  'channex-daily-sync',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://phvduifvymozqiqwvajj.supabase.co/functions/v1/channex-daily-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBodmR1aWZ2eW1venFpcXd2YWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzOTA5NjksImV4cCI6MjA3NTk2Njk2OX0.dUvKctUckLL2ZErxKjeek1rtRptZPTG8Mrklm4eMPZQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

This requires the `pg_cron` and `pg_net` extensions to be enabled (pg_net is already enabled since triggers use it; pg_cron may need enabling).

### Technical Details

**Edge function structure:**

```text
1. Fetch all property mappings
2. For each property:
   a. Fetch room type mappings for this property
   b. For each room type:
      - Get all units with this booking_com_name
      - For each date in next 365 days, calculate availability
      - Collapse consecutive same-availability dates into ranges
      - Batch into groups of 10
      - Push each batch to /api/v1/availability
      - Wait 6s between batches
   c. Fetch rate plan mappings for this property
   d. For each rate plan:
      - Get rate_plan_prices rows
      - Build value objects with date ranges and rates in cents
      - Batch into groups of 10
      - Push each batch to /api/v1/restrictions
      - Wait 6s between batches
3. Log summary to channex_sync_logs
4. Return JSON summary
```

**Return format:**
```text
{
  "success": true,
  "summary": {
    "properties_synced": 1,
    "availability_values_pushed": 365,
    "rate_values_pushed": 12,
    "errors": []
  },
  "duration_seconds": 45
}
```

**Error handling**: Each property is wrapped in try/catch. Individual room type or rate plan failures are collected in the errors array but do not stop processing of other items. The overall response is `success: true` if at least one property was processed, with errors included in the summary.

