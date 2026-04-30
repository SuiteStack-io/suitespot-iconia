# Wire dynamic pricing into Channex sync pipeline

Approved plan + three review fixes (FIX 1/2/3). Source of truth for all calculation logic: `supabase/functions/calculate-dynamic-price/index.ts` lines 140–504.

## 1. New shared module — `supabase/functions/_shared/dynamic-pricing.ts`

Pure module — no `Deno.serve`, no I/O, no Supabase client. Exports:

- `DynamicPricingContext` — `{ property, pricingRules, reservations, units, overrides, promotions, todayStrInTz, monthlyRevenueByMonth, monthlyBookedNightsByMonth }`
- `DynamicPricingInput` — `{ target_date, room_type, rate_plan_id, weekday_rate, weekend_rate, off_peak_rate, min_rate, max_rate }`
- `DynamicPricingResult` — `final_rate_cents` + every column needed by `pricing_log` + `month_phase` + `static_reason`
- `calculateDynamicRate(ctx, input): DynamicPricingResult`

Implementation = literal port of calculate-dynamic-price lines 140–504, with:
- All DB reads replaced by ctx fields
- `pricing_overrides` filter: `o.override_date === input.target_date`, then specific room_type before wildcard
- `promotional_periods` filter (in JS): `is_active !== false` AND `booking_window_start <= todayStrInTz <= booking_window_end` AND `stay_start <= target_date <= stay_end` AND (`!room_types || room_types.includes(room_type)`)
- Per-month occupancy nights and revenue cached in `ctx.monthlyBookedNightsByMonth[YYYY-MM]` / `ctx.monthlyRevenueByMonth[YYYY-MM]` so cost is paid once per month, not per date
- `pricing_log.insert` removed — caller batches
- Defensive: if `!rules || rules.is_enabled === false`, returns a static-clamp result with `static_reason` populated (caller is expected to gate, but helper never crashes)

Byte-identical: dow branch order (off-peak → weekend → weekday), `tierIndex`, override precedence (override skips dow/occ/revenue/promotion), promotion winner (largest `savings`, then most recently created), pace-index bump, revenue-occupancy conflict cap, two-layer clamp + zero-floor safety.

## 2. `channex-full-sync/index.ts`

**FIX 2 — placement:** insert pre-load AFTER line 82 (`const endDate = addDays(today, SYNC_DAYS)`), so `endDate` is in scope.

- Add `timezone` to property select (line 67–70).
- After line 82, load `pricingRules` (always). When `pricingRules?.is_enabled === true`:
  - `todayInTz = new Date().toLocaleDateString('en-CA', { timeZone: propertyExists.timezone || 'Africa/Cairo' })`
  - `promotions` — `promotional_periods` for property, `is_active=true`, booking window covering `todayInTz`, stay window overlapping `[todayInTz, formatDate(endDate)]`
  - `overrides` — `pricing_overrides` for property, `override_date BETWEEN todayInTz AND formatDate(endDate)`
  - `unitsForOcc` — units for property, `status != 'maintenance'`
  - `reservationsForOcc` — reservations for property, `status IN ('confirmed','checked-in')`, overlapping `[todayInTz, formatDate(endDate)]`
  - `monthlyRevenueByMonth = {}`, `monthlyBookedNightsByMonth = {}`, `pricingLogRows: any[] = []`

In the rate-day loop (lines 289–309), wrap in `if (dynamicPricingEnabled) { … } else { existing static }`. Dynamic branch calls `calculateDynamicRate(ctx, { target_date: ds, room_type: p.room_type, rate_plan_id: ratePlan.id, weekday_rate: p.weekday_rate, weekend_rate: p.weekend_rate || p.weekday_rate, off_peak_rate: p.off_peak_rate || p.weekday_rate, min_rate: p.min_rate, max_rate: p.max_rate })`, pushes `{ date: ds, rate: result.final_rate_cents }`. When `result.month_phase === 'A' || 'B'` and `!result.static_reason`, push a `pricing_log` row.

Overlay logic (lines 311–329) untouched — manual `rate_plan_restrictions.rate` and `rate_plan_date_overrides` continue to win.

After the rate-plan loop, before `logSync` (~line 408): `if (pricingLogRows.length > 0) await supabase.from('pricing_log').insert(pricingLogRows)`.

## 3. `channex-daily-sync/index.ts`

Same pattern as §2, applied per property inside `for (const propMapping of validMappings)` (line 86):
- Add `timezone` to property select (line 93)
- After property config load, pre-load `pricingRules` for `propMapping.local_id`. If enabled, load promotions/overrides/units/reservations scoped to that property and `[todayInTz, formatDate(endDate)]`. Init monthly caches and `pricingLogRows: any[] = []` per property.
- Replace per-day calc (lines 321–331) with `if (dynamicPricingEnabled) { … } else { static }`.
- Overlay block (333–351) unchanged.
- Batch-insert that property's `pricingLogRows` after its rate-plan loop, before `summary.properties_synced++`.

## 4. `channex-process-sync-queue/index.ts`

In rate-items branch (line 194):

- Maintain `propertyDynamicCache: Map<propertyId, { enabled: boolean; ctx?: DynamicPricingContext; pricingLogRows: any[] }>`. On first encounter of a `propertyId`, load `pricing_rules` + (if enabled) promotions/overrides/units/reservations scoped to `[today, today+365]`.
- **FIX 3 — bounded date range:** dynamic branch must use the SAME `dateFrom`/`dateTo` the static branch already computes (lines 240–241): `dateFrom = ratePlanData.valid_from || todayStr`, `dateTo = ratePlanData.valid_to || (today+365)`, `rateStartDate = max(dateFrom, todayStr)`. Iterate exactly that range — no broader, no narrower.
- Replace per-day `rateCents` (lines 253–263) with `calculateDynamicRate(ctx, {...})` using `payload.weekday_rate / weekend_rate / off_peak_rate` and `payload.min_rate ?? null`, `payload.max_rate ?? null`. Same `dailyRates` array; collapse logic (266–289) unchanged.
- Push log rows into per-property bucket.

After processing all queue items, batch-insert the union of all `pricingLogRows` (each row carries `property_id`) in one `pricing_log.insert`.

## 5. `channex-push-rates/index.ts` — final safety clamp

After the validation loop (line 118), before the value-build loop (line 144):

**FIX 1 — multi-property bounds query:**

```ts
const uniquePropertyIds = Array.from(new Set(updates.map(u => u.property_id)));
const { data: bounds } = await serviceSupabase
  .from('rate_plan_prices')
  .select('rate_plan_id, room_type, min_rate, max_rate, rate_plans!inner(property_id)')
  .in('rate_plans.property_id', uniquePropertyIds)
  .is('unit_id', null);

const boundsByPlan = new Map<string, { min: number | null; max: number | null }>();
for (const row of (bounds || [])) {
  const min = row.min_rate != null ? Number(row.min_rate) : null;
  const max = row.max_rate != null ? Number(row.max_rate) : null;
  const existing = boundsByPlan.get(row.rate_plan_id);
  if (!existing) {
    boundsByPlan.set(row.rate_plan_id, { min, max });
  } else {
    boundsByPlan.set(row.rate_plan_id, {
      min: existing.min === null || (min !== null && min < existing.min) ? min : existing.min,
      max: existing.max === null || (max !== null && max > existing.max) ? max : existing.max,
    });
  }
}
```

In the value-build loop, after computing `Math.round(u.rate * 100)`:
- If `u.rate <= 0`: push to `errors` with `"rate must be > 0"`, `continue` (skip this value, batch continues).
- Else look up `boundsByPlan.get(u.rate_plan_id)`:
  - `b.min !== null && u.rate < b.min` → `console.warn('[channex-push-rates] Clamped rate below min', { original: u.rate, clamped: b.min, rate_plan_id: u.rate_plan_id })`, `value.rate = Math.round(b.min * 100)`.
  - Else `b.max !== null && u.rate > b.max` → `console.warn('[channex-push-rates] Clamped rate above max', { original: u.rate, clamped: b.max, rate_plan_id: u.rate_plan_id })`, `value.rate = Math.round(b.max * 100)`.

## 6. Variable hygiene

- New identifiers introduced once per function scope.
- `weekdayRateCents`/`weekendRateCents`/`offPeakRateCents` exist only in the static `else` branch.
- `dailyRates` declared once; both branches push into it.
- Overlay block's `restrictionOverride`/`dateOverride` stay scoped to the inner loop body.

## 7. Out of scope

`calculate-dynamic-price/index.ts`, DB schema, overlay logic, min_stay_arrival, Channex API call shape, frontend, non-sync edge functions.

## 8. Verification

- Manual full sync → hundreds of `pricing_log` rows, `promotion_id` set inside active promotion stay windows.
- Channex dashboard rates inside promotion window are discounted.
- `pricing_rules.is_enabled = false` → static rates push, no new `pricing_log` rows.
