

## Automatic Channex Sync: Database Triggers + Edge Function

### How It Works (The Flow)

When you change data in your PMS, the system will automatically push those changes to Channex without any manual action. Here is the flow:

```text
+-------------------+       +--------------------+       +---------------------+       +---------+
| You update data   | ----> | DB trigger fires   | ----> | Queue row created   | ----> | Edge fn |
| (reservation,     |       | (checks if synced  |       | in channex_sync_    |       | picks   |
|  rate, blocked     |       |  to Channex, skips |       | queue table         |       | it up & |
|  date, etc.)       |       |  if from Channex)  |       |                     |       | pushes  |
+-------------------+       +--------------------+       +---------------------+       +---------+
                                                                    |
                                                          pg_net HTTP call
                                                          (with 2s delay)
```

**Loop prevention**: Each trigger checks if the change originated from Channex (via the `channel` field or a `skip_channex_sync` column). If it did, the trigger does nothing.

**Debouncing**: Changes are queued, and the processing function batches them. The `pg_net` call has a built-in delay. Duplicate queue entries for the same room type + date range are deduplicated.

### What Gets Created

#### 1. Database: `channex_sync_queue` table
A buffer table that holds pending sync operations.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| sync_type | text | `availability` or `rate` |
| property_id | uuid | Which property |
| entity_id | uuid | Room type ID or rate plan ID |
| date_from | date | Start of affected date range |
| date_to | date | End of affected date range |
| payload | jsonb | Extra data (availability count, rate amount, etc.) |
| status | text | `pending`, `processing`, `completed`, `failed` |
| error_message | text | If it failed, why |
| created_at | timestamptz | When queued |
| processed_at | timestamptz | When processed |

RLS: Service-role only (system table).

#### 2. Database: Add `skip_channex_sync` column to `reservations`
A boolean flag (default `false`) that can be set to `true` when a reservation comes from Channex, preventing the trigger from re-syncing it back.

#### 3. Database Trigger: `on_reservation_change`
Fires on INSERT/UPDATE/DELETE on the `reservations` table.

- **Skips if**: `NEW.skip_channex_sync = true` OR `NEW.channel = 'Channex'`
- **What it does**: Looks up the unit's room type, checks if it has a `channex_mappings` record. If yes, calculates availability for the affected date range and inserts a queue row.
- **Availability calculation**: Counts total units of same room type minus confirmed/checked-in reservations for each date.

#### 4. Database Trigger: `on_blocked_dates_change`
Fires on INSERT/DELETE on `blocked_dates`.

- Same logic as reservation trigger -- blocked dates reduce availability for the room type.

#### 5. Database Trigger: `on_rate_plan_prices_change`
Fires on INSERT/UPDATE on `rate_plan_prices`.

- Checks if the rate plan has a `channex_mappings` record. If yes, queues a `rate` sync.

#### 6. Edge Function: `channex-process-sync-queue`
A new serverless function that:

1. Reads all `pending` rows from `channex_sync_queue`
2. Groups them by sync_type (availability vs. rates)
3. Resolves Channex IDs from `channex_mappings`
4. Calls the Channex API directly (reusing `channex-client.ts`)
5. Marks queue rows as `completed` or `failed`
6. Logs everything to `channex_sync_logs`

This function uses **service role auth** (no user login needed) since it is triggered by the system.

#### 7. `pg_net` calls from triggers
Each trigger uses `pg_net.http_post()` to call the `channex-process-sync-queue` edge function after inserting a queue row. The call is fire-and-forget with a small delay built into Postgres's async HTTP.

#### 8. Update `channex-booking-webhook`
When a booking comes in from Channex and creates a local reservation, set `skip_channex_sync = true` to prevent the loop.

### Important Safeguards

- **Loop prevention**: `skip_channex_sync` flag + `channel = 'Channex'` check in triggers
- **Rate limiting**: Queue-based approach means rapid changes get batched. The edge function processes all pending items at once rather than one-per-trigger.
- **Only synced rooms**: Triggers check `channex_mappings` before queuing -- rooms not synced to Channex are ignored.
- **Failure handling**: Failed pushes are marked in the queue with error messages, visible in the Sync Logs tab.
- **Channex auto-availability**: For bookings specifically, Channex can handle availability reduction automatically if `allow_availability_autoupdate` is enabled on the property. The reservation trigger is a safety net.

### Technical Details

**Trigger function (reservation example):**
```text
CREATE OR REPLACE FUNCTION notify_channex_availability_change()
RETURNS trigger AS $$
DECLARE
  v_unit_id uuid;
  v_room_name text;
  v_property_id uuid;
  v_has_mapping boolean;
BEGIN
  -- Determine the unit_id from OLD or NEW
  v_unit_id := COALESCE(NEW.unit_id, OLD.unit_id);
  IF v_unit_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  -- Skip if flagged
  IF TG_OP != 'DELETE' AND NEW.skip_channex_sync = true THEN
    RETURN NEW;
  END IF;

  -- Skip if from Channex
  IF TG_OP != 'DELETE' AND NEW.channel = 'Channex' THEN
    RETURN NEW;
  END IF;

  -- Check if this unit's room type is synced to Channex
  SELECT u.booking_com_name, u.location INTO v_room_name, ...
  -- Look up channex_mappings for entity_type = 'room_type'
  -- If no mapping exists, skip

  -- Insert into channex_sync_queue
  INSERT INTO channex_sync_queue (sync_type, property_id, entity_id, date_from, date_to, payload)
  VALUES ('availability', v_property_id, v_room_type_mapping_id, ...);

  -- Fire-and-forget HTTP call to process the queue
  PERFORM net.http_post(
    url := '<SUPABASE_URL>/functions/v1/channex-process-sync-queue',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Edge function (`channex-process-sync-queue`):**
- No user auth required (called by system via service role)
- Reads pending queue items, batches by type
- Calls Channex availability/restrictions API
- Updates queue status

**Config (`supabase/config.toml`):**
```text
[functions.channex-process-sync-queue]
verify_jwt = false
```

