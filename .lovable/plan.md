

## Fix: Channex Availability Not Reflecting Unit Count

### Root Cause

Two issues are preventing the correct availability (10) from reaching Channex:

1. **`channex-full-sync` missing from `config.toml`** — Without an explicit `verify_jwt = false` entry, the function defaults to `verify_jwt = true`. While `supabase.functions.invoke()` sends a JWT, this is likely causing silent failures since no sync logs exist after March 2nd (before units were cloned). Adding it to config ensures consistent behavior.

2. **`calculateAvailability` in `channex-process-sync-queue` has a broken `.in()` call** — Lines 486-493 and 496-501 pass a Supabase query builder object to `.in("unit_id", unitSubquery)`. The `.in()` method expects an `Array`, not a query builder. This silently fails, likely returning 0 for both `reservedCount` and `blockedCount`. While this accidentally gives the right total for empty calendars, it will produce wrong results when reservations exist. The fix: execute the unit subquery first to get an array of IDs, then pass that array to `.in()`.

3. **No automatic sync trigger when units are added/cloned** — The database triggers only fire on reservation and blocked_date changes, not when new units are created. After cloning 10 units, no sync is triggered. A full sync must be manually run.

### Changes

**File: `supabase/config.toml`**
- Add `[functions.channex-full-sync]` with `verify_jwt = false` to ensure the function is properly deployed and accessible.

**File: `supabase/functions/channex-process-sync-queue/index.ts`**
- Fix `calculateAvailability` (lines 479-501): Execute the unit IDs query first to get an array, then use that array in `.in()` calls for reservations and blocked_dates queries.

```text
// Before (broken):
let unitSubquery = supabase.from("units").select("id")...
.in("unit_id", unitSubquery)  // ← query builder, not array

// After (fixed):
const { data: unitRows } = await supabase.from("units").select("id")...
const unitIds = (unitRows || []).map(u => u.id);
.in("unit_id", unitIds)       // ← actual array
```

These two fixes ensure:
- Full sync can be triggered and deploys correctly
- Automated availability calculations return accurate counts when reservations exist

After deployment, running "Full Sync (500 days)" from the Channex admin page will push AVL=10 for both Twin Room and Double Room.

