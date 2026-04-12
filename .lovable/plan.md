

## Database Foundation for Dynamic Pricing Algorithm

### Changes — 1 Migration (5 parts)

**Part 1: Add columns to `rate_plan_prices`**
- `min_rate NUMERIC(10,2) DEFAULT NULL`
- `max_rate NUMERIC(10,2) DEFAULT NULL`

**Part 2: Create `pricing_rules` table**
- One row per property with all algorithm config (day-of-week multipliers, occupancy thresholds/adjustments, revenue targets, lead-time strategy, conflict rules, etc.)
- UNIQUE on `property_id`
- RLS: SELECT `USING (true)`, INSERT/UPDATE/DELETE via `user_has_property_access(property_id, 'manager')`
- `updated_at` trigger using existing `update_updated_at_column()`

**Part 3: Create `pricing_overrides` table**
- Manual date-level overrides (fixed_rate, percentage_adjustment, multiplier)
- `UNIQUE(property_id, override_date, room_type)` for non-null room types
- Partial unique index for NULL room_type: `CREATE UNIQUE INDEX pricing_overrides_unique_all_rooms ON pricing_overrides (property_id, override_date) WHERE room_type IS NULL`
- RLS: SELECT `USING (true)`, INSERT/UPDATE/DELETE via `user_has_property_access(property_id, 'manager')`

**Part 4: Create `pricing_log` table**
- Append-only audit log with all calculation inputs/outputs
- Indexes on `(property_id, date_priced)` and `(property_id, calculated_at)`
- RLS: SELECT for authenticated, INSERT open (service role), no UPDATE/DELETE

**Part 5: Backfill**
- Insert disabled `pricing_rules` row for every existing property

### What Does NOT Change
- `rate_plans`, `rate_plan_restrictions`, `reservations`, `properties` tables
- Existing columns on `rate_plan_prices`
- Edge Functions, Channex sync, UI components
- Existing RLS policies

