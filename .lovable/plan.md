

## Full Restrictions Support for Channex Integration

### Overview

Add date-specific booking restrictions (min stay, max stay, stop sell, closed to arrival/departure) to the PMS, with a calendar view, bulk editor, and automatic Channex synchronization. The existing rate plan configuration (Policy, Meals, Value Adds, Bookable, Price) remains unchanged.

---

### Phase 1: Database Changes

**Migration 1: Create `rate_plan_restrictions` table and add default columns to `rate_plans`**

```sql
-- New table for date-specific restrictions
CREATE TABLE rate_plan_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_plan_id UUID NOT NULL REFERENCES rate_plans(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  min_stay INTEGER DEFAULT 1,
  max_stay INTEGER,
  stop_sell BOOLEAN DEFAULT FALSE,
  closed_to_arrival BOOLEAN DEFAULT FALSE,
  closed_to_departure BOOLEAN DEFAULT FALSE,
  synced_to_channex BOOLEAN DEFAULT FALSE,
  channex_task_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_restrictions_rate_plan ON rate_plan_restrictions(rate_plan_id);
CREATE INDEX idx_restrictions_dates ON rate_plan_restrictions(date_from, date_to);

-- Enable RLS
ALTER TABLE rate_plan_restrictions ENABLE ROW LEVEL SECURITY;

-- Admins/managers can manage
CREATE POLICY "Admins and managers can manage restrictions"
  ON rate_plan_restrictions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Authenticated users can view
CREATE POLICY "Authenticated users can view restrictions"
  ON rate_plan_restrictions FOR SELECT
  USING (true);

-- Default restriction columns on rate_plans
ALTER TABLE rate_plans
  ADD COLUMN IF NOT EXISTS default_min_stay INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS default_max_stay INTEGER,
  ADD COLUMN IF NOT EXISTS default_stop_sell BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS default_closed_to_arrival BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS default_closed_to_departure BOOLEAN DEFAULT FALSE;

-- Updated_at trigger
CREATE TRIGGER update_rate_plan_restrictions_updated_at
  BEFORE UPDATE ON rate_plan_restrictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Phase 2: UI Components (New Files)

#### 2a. `src/components/pms/DefaultRestrictionsCard.tsx`

Displays default restrictions for the selected rate plan with inline editing:
- Min Stay: number input (1-30)
- Max Stay: number input (1-365) or empty
- Stop Sell: Switch toggle
- Closed to Arrival: Switch toggle
- Closed to Departure: Switch toggle
- Save button that updates `rate_plans` table directly

#### 2b. `src/components/pms/BulkRestrictionEditor.tsx`

Form for applying restrictions to a date range:
- Rate Plan dropdown (select one or "All Rate Plans")
- Date From / Date To pickers (using Popover + Calendar)
- Checkboxes to enable each restriction type, with inputs:
  - Min Stay (number)
  - Max Stay (number)
  - Stop Sell (toggle)
  - Closed to Arrival (toggle)
  - Closed to Departure (toggle)
- "Apply Restrictions" button: upserts into `rate_plan_restrictions`, marks `synced_to_channex = false`, triggers push
- "Clear Restrictions" button: deletes restrictions for the date range
- Validation: min_stay >= 1, max_stay > min_stay, dates must be today or future

#### 2c. `src/components/pms/RestrictionCalendarView.tsx`

Horizontal scrollable grid showing restrictions by date:
- Rows: one per rate plan (showing name + room type)
- Columns: next 90 days, scrollable
- Cells show compact badges:
  - "MS:3" (blue) for min stay
  - Red dot for stop sell
  - "CTA" (yellow) for closed to arrival
  - "CTD" (yellow) for closed to departure
- Click a cell to open a popover/dialog to edit that specific date's restrictions
- Color coding: red background tint for stop sell, yellow for CTA/CTD, blue outline for non-default min stay
- Sync status indicator (green check if synced, orange dot if pending)

#### 2d. `src/components/pms/RestrictionBadge.tsx`

Small badge component used in the calendar cells:
- Props: type (min_stay | max_stay | stop_sell | cta | ctd), value
- Tooltip on hover showing full description
- Color-coded by type

---

### Phase 3: Update Restrictions Page

**File: `src/pages/pms/Restrictions.tsx`**

Replace the single-view layout with a tabbed layout:

```text
Tabs:
  [Rate Plan Settings] [Restrictions Calendar] [Bulk Editor]
```

- **Rate Plan Settings tab**: Keep ALL existing functionality (policy, meals, value adds, bookable, price rows) plus add `DefaultRestrictionsCard` below the existing card
- **Restrictions Calendar tab**: Render `RestrictionCalendarView`
- **Bulk Editor tab**: Render `BulkRestrictionEditor`

The rate plan selector dropdown moves above the tabs so it applies to all views.

---

### Phase 4: Edge Function for Pushing Restrictions

**File: `supabase/functions/channex-push-restrictions/index.ts`**

New edge function that:
1. Accepts optional `rate_plan_id` param (or processes all unsynced)
2. Queries `rate_plan_restrictions` where `synced_to_channex = false`
3. For each restriction, resolves Channex property_id and rate_plan_id from `channex_mappings`
4. Merges with default restrictions from `rate_plans` table (date-specific overrides take priority)
5. Builds Channex payload:
   ```json
   {
     "values": [{
       "property_id": "channex-prop-id",
       "rate_plan_id": "channex-rp-id",
       "date_from": "2026-03-01",
       "date_to": "2026-03-15",
       "min_stay_arrival": 2,
       "max_stay": 14,
       "stop_sell": false,
       "closed_to_arrival": false,
       "closed_to_departure": false
     }]
   }
   ```
6. Pushes to Channex `POST /api/v1/restrictions` in batches of 10 with 6s delays
7. Updates `synced_to_channex = true` and stores `channex_task_id` on success
8. Logs to `channex_sync_logs`
9. Authentication: requires admin session (same pattern as `channex-push-rates`)

Note: This uses the same Channex endpoint (`/api/v1/restrictions`) as rate pushes -- Channex combines rates and restrictions in one endpoint. The function only sends restriction fields (no `rate` field).

---

### Phase 5: Update Daily Sync

**File: `supabase/functions/channex-daily-sync/index.ts`**

In the existing rate push section (section 2b), after building rate values, also include restriction fields:
1. Query `rate_plan_restrictions` for each rate plan covering the sync window
2. Query default restrictions from `rate_plans` table
3. For each 30-day chunk, determine applicable restrictions (date-specific overrides > defaults)
4. Add `min_stay_arrival`, `max_stay`, `stop_sell`, `closed_to_arrival`, `closed_to_departure` fields to each rate value object
5. Add `restriction_values_pushed` to the summary counter

This means rates + restrictions are pushed together in each chunk, which is how Channex expects it.

---

### Phase 6: Automatic Sync on Save

When the user saves restrictions via the Bulk Editor or Calendar cell edit:
1. Save to `rate_plan_restrictions` table with `synced_to_channex = false`
2. Call `channex-push-restrictions` edge function via `supabase.functions.invoke()`
3. Show toast: "Restrictions saved and syncing to Channex..."
4. On success: "Restrictions synced to Channex"
5. On error: "Restrictions saved locally but Channex sync failed"
6. Refresh calendar view to show updated sync status

---

### Validation Rules (Client-side + Edge Function)

- `min_stay` must be >= 1
- `max_stay` must be > `min_stay` (if both set)
- `date_from` must be today or future
- `date_to` must be >= `date_from`
- Warn (not block) if `stop_sell` AND `closed_to_arrival` are both set (redundant)

---

### File Summary

| Action | File |
|--------|------|
| Create | `src/components/pms/DefaultRestrictionsCard.tsx` |
| Create | `src/components/pms/BulkRestrictionEditor.tsx` |
| Create | `src/components/pms/RestrictionCalendarView.tsx` |
| Create | `src/components/pms/RestrictionBadge.tsx` |
| Modify | `src/pages/pms/Restrictions.tsx` (add tabs, integrate new components) |
| Create | `supabase/functions/channex-push-restrictions/index.ts` |
| Modify | `supabase/functions/channex-daily-sync/index.ts` (include restrictions in rate push) |
| Migration | Create `rate_plan_restrictions` table, add default columns to `rate_plans` |

