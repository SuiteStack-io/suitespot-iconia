

## Bug: Single-date rate change overwrites ALL dates

### Root Cause

The `rate_plan_prices` table stores only **one `weekday_rate` and one `weekend_rate` per rate plan** — there is no date-specific pricing. When you change Mar 7 (weekend) from $135 to $120, the `syncNow` function updates `weekend_rate = 120` on the `rate_plan_prices` row, which applies to **every** weekend date.

This was introduced by the previous fix that added DB persistence to `syncNow()` (lines 476-496). The Channex sync queue correctly sends date-specific overrides (one date at a time), but the local DB update blindly overwrites the base rate.

### Solution: Date-specific rate overrides table

Create a `rate_plan_date_overrides` table to store per-date rate overrides separately from base rates. The grid will:
1. Load base rates from `rate_plan_prices` (as today)
2. Load date-specific overrides from `rate_plan_date_overrides`
3. Display: override rate if one exists for that date, otherwise base rate
4. On save: insert/upsert into `rate_plan_date_overrides` instead of updating the base `rate_plan_prices` row

### Database migration

```sql
CREATE TABLE public.rate_plan_date_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_plan_id uuid NOT NULL REFERENCES rate_plans(id) ON DELETE CASCADE,
  override_date date NOT NULL,
  rate numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (rate_plan_id, override_date)
);

ALTER TABLE public.rate_plan_date_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Property managers can manage date overrides"
  ON public.rate_plan_date_overrides FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rate_plans rp
      WHERE rp.id = rate_plan_id
      AND user_has_property_access(rp.property_id, 'manager')
    )
  );

CREATE POLICY "Public can view date overrides"
  ON public.rate_plan_date_overrides FOR SELECT
  USING (true);
```

### Code changes — `src/components/pms/QuickRateGrid.tsx`

1. **`fetchData()`**: Also fetch `rate_plan_date_overrides` for the visible date range. Store in a new state `dateOverrides: Record<string, number>` keyed by `ratePlanId:date`.

2. **`getEffectiveRate()`**: Check `dateOverrides[key]` before falling back to base weekday/weekend rate.

3. **`syncNow()` — DB persistence** (lines 476-496): Replace the `rate_plan_prices.update()` with `rate_plan_date_overrides.upsert()` for each pending change. Each change writes one row with `rate_plan_id`, `override_date`, and `rate`.

4. **`syncNow()` — local state update** (lines 500-514): Update `dateOverrides` state instead of mutating `prices` base rates.

5. **Re-fetch on date navigation**: When `weekStart` changes, re-fetch overrides for the new visible range so date-specific prices load correctly.

### Data flow after fix

```text
Grid cell display:
  dateOverrides[planId:date] → if exists, use it
  otherwise → isWeekendRate(date) ? price.weekend_rate : price.weekday_rate

Save single date (Mar 7 = $120):
  1. Upsert rate_plan_date_overrides: (planId, 2026-03-07, 120)
  2. Push to channex_sync_queue: date_from=Mar 7, date_to=Mar 7
  3. Update local dateOverrides state: { "planId:2026-03-07": 120 }
  4. Base rates in rate_plan_prices remain UNCHANGED
```

### Files to edit
- **Database migration**: Create `rate_plan_date_overrides` table with RLS
- **`src/components/pms/QuickRateGrid.tsx`**: Fetch overrides, use them in display, save to overrides table instead of base rates
- **`src/lib/rateResolver.ts`**: Update `getActiveRate()` to also check date overrides (so other pages like BookingFlow see correct prices)

