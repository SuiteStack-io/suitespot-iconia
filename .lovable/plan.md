

## Update default_min_stay_arrival to 2-Night Minimum

### Database Migration

Run a single UPDATE to change `default_min_stay_arrival` from `{1,1,1,1,1,1,1}` to `{2,2,2,2,2,2,2}` on all rate plans where it's currently `{1,1,1,1,1,1,1}`:

```sql
UPDATE rate_plans 
SET default_min_stay_arrival = '{2,2,2,2,2,2,2}'::integer[] 
WHERE default_min_stay_arrival = '{1,1,1,1,1,1,1}'::integer[];
```

This updates all 6 rate plans (5 active + 1 archived). The archived one won't affect anything since it's not synced to Channex.

### Verification

After migration, confirm both arrays match:
- `default_min_stay_arrival`: `{2,2,2,2,2,2,2}`
- `default_min_stay_through`: `{2,2,2,2,2,2,2}` (already correct on 5 active plans)

### No Code Changes

No edge functions, UI components, or other files are modified.

### After Migration

You'll need to manually click "Run Full Sync Now" to push `min_stay_arrival: 2` to Channex for all 500 days.

