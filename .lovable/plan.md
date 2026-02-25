

# Plan: Split Min Stay into Arrival + Through (Channex-Compatible)

## Approach
The existing `min_stay` column already behaves as "min stay through" (minimum nights for any booking that includes this date). We will rename it to `min_stay_through` and add a new `min_stay_arrival` column (minimum nights when a guest arrives on this date).

---

## Database Migrations

### Migration: `rate_plan_restrictions` table
```sql
ALTER TABLE rate_plan_restrictions RENAME COLUMN min_stay TO min_stay_through;
ALTER TABLE rate_plan_restrictions ADD COLUMN min_stay_arrival INTEGER DEFAULT 1;
```

### Migration: `rate_plans` table (defaults)
```sql
ALTER TABLE rate_plans RENAME COLUMN default_min_stay TO default_min_stay_through;
ALTER TABLE rate_plans ADD COLUMN default_min_stay_arrival INTEGER DEFAULT 1;
```

---

## Files to Modify

### 1. `src/components/pms/BulkRestrictionEditor.tsx`
- Replace `enableMinStay`/`minStay` with two separate state pairs: `enableMinStayArrival`/`minStayArrival` and `enableMinStayThrough`/`minStayThrough`
- Two checkbox rows in the UI with descriptions:
  - "Min Stay Arrival" — guest arriving on this date must stay at least X nights
  - "Min Stay Through" — any booking including this date must be at least X nights
- Update insert payload: `min_stay_arrival` and `min_stay_through` instead of `min_stay`
- Update validation: both >= 1, max_stay >= both (if set), warning if Stop Sell + CTA both checked
- Add sync status section: pending count query, last sync timestamp, "Sync Now" button

### 2. `src/components/pms/RestrictionCalendarView.tsx`
- Update `Restriction` interface: `min_stay` → `min_stay_through`, add `min_stay_arrival`
- Update cell edit dialog: two inputs ("Min Stay Arrival" and "Min Stay Through") instead of one "Min Stay"
- Update state: `editMinStay` → `editMinStayThrough` + new `editMinStayArrival`
- Update `handleCellSave` to write both columns
- Update calendar cell rendering to show both badge types (`A:X` and `T:X`)
- Add sync status indicator below the calendar grid

### 3. `src/components/pms/DefaultRestrictionsCard.tsx`
- Rename `default_min_stay` → `default_min_stay_through` in interface and state
- Add `default_min_stay_arrival` field
- Two separate inputs with descriptions
- Update validation and save payload

### 4. `src/components/pms/RestrictionBadge.tsx`
- Replace `min_stay` type with `min_stay_arrival` and `min_stay_through`
- `min_stay_arrival`: label `A:X`, blue badge
- `min_stay_through`: label `T:X`, purple badge (`bg-purple-100 text-purple-800 border-purple-300`)

### 5. `src/pages/pms/Restrictions.tsx`
- Update `RatePlan` interface: `default_min_stay` → `default_min_stay_through`, add `default_min_stay_arrival`
- Update the select query to fetch both new column names

### 6. `supabase/functions/channex-push-restrictions/index.ts`
- Update payload to send both fields from the renamed columns:
  ```
  min_stay_arrival: r.min_stay_arrival || 1,
  min_stay_through: r.min_stay_through || 1,
  ```
- Remove old `min_stay_arrival: r.min_stay || 1` mapping

---

## Sync Status Indicator (added to RestrictionCalendarView + BulkRestrictionEditor)
- Query `rate_plan_restrictions` where `synced_to_channex = false` for pending count
- Query `channex_sync_logs` for latest `channex-push-restrictions` entry for last sync time
- "Sync Now" button invoking `channex-push-restrictions`
- Auto-refresh status after sync

## Validation Rules
- `min_stay_arrival >= 1`
- `min_stay_through >= 1`
- `max_stay >= min_stay_arrival` and `>= min_stay_through` (if set)
- `max_stay` of 0 or empty = no limit
- Date range: from >= today, to >= from
- Warning toast if Stop Sell + CTA both checked

