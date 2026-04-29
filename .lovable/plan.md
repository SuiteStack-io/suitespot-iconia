# calculate-dynamic-price Edge Function

Create one new file: `supabase/functions/calculate-dynamic-price/index.ts`. Service-role only; no other files, no DB/schema changes.

## Skeleton
- `corsHeaders` copied verbatim from `channex-full-sync/index.ts` (lines 12–16).
- `Deno.serve` handler with `OPTIONS` preflight returning `corsHeaders`.
- `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`.
- Helpers: `formatDate`, `addDays`, `daysInMonth`, `round2`, `tierIndex(value, ascendingThresholds)`, `respond(status, body)`.

## Input validation
Parse JSON body. Require `property_id`, `room_type`, `rate_plan_id`, `target_date` (regex `^\d{4}-\d{2}-\d{2}$`). 400 if missing/malformed.

## Logic

**1. Property** — `properties.select("id, weekend_days, off_peak_days, timezone")`. 404 if missing. Defaults: `weekend_days || [4,5]`, `off_peak_days || []`, `timezone || "Africa/Cairo"`.

**2. Rate plan + price row** — Verify `rate_plans.id` exists (404 if not). Then `rate_plan_prices.select("weekday_rate, weekend_rate, off_peak_rate, min_rate, max_rate").eq(rate_plan_id).eq(room_type).is(unit_id, null).maybeSingle()`. If null, fall back to the same query without the `unit_id` filter (limit 1). If still null → 404. Single mutable `priceRow` variable assigned via a `let priceRow: any = null` plus two scoped `{ ... }` blocks — no double declaration.

**3. Base rate** (matches `channex-full-sync` lines 291–307):
- `targetDate = new Date(target_date + "T00:00:00Z")`, `dow = targetDate.getUTCDay()` (UTC-safe since target_date is a calendar date).
- off-peak takes priority, then weekend, else weekday.

**4. pricing_rules** — `.eq(property_id).maybeSingle()`.

**Static fast path (PER USER FIX — Option 1)**: if `!rules || rules.is_enabled === false`:
- Clamp `baseRate` against room-type min/max.
- Layer-2 safety (≤0 → fallback to baseRate).
- Round.
- **Do NOT insert into pricing_log** (the CHECK constraint on `month_phase` only allows 'A' or 'B', and a static rate is not a dynamic pricing decision worth logging).
- Return `{ success, base_rate, final_rate, adjustments: { ..., month_phase: null, static_reason: 'dynamic_pricing_disabled' | 'no_pricing_rules', ... } }`.

**5. Override** — `pricing_overrides.select("id, override_type, value, room_type").eq(property_id).eq(override_date, target_date)`. Prefer specific room_type, else wildcard `room_type IS NULL`.

**6. Day-of-week multiplier** — `Number(rules.day_of_week_multipliers[String(dow)] ?? 1)`.

**7. Occupancy for target month**:
- Compute `monthStart`, `monthEnd` (last day inclusive), `monthStartStr`, `monthEndExclusiveStr`.
- `units` query (matches lines 123–128): `.eq(property_id).neq(status, 'maintenance')`.
- `reservations` query (matches lines 135–141): `.in(status, ['confirmed','checked-in']).in(unit_id, unitIds).lt(check_in_date, monthEndExclusiveStr).gt(check_out_date, monthStartStr)`.
- Count overlap nights per reservation by clamping `[check_in_date, check_out_date)` into `[monthStartStr, monthEndExclusiveStr)` (checkout exclusive).
- `occupancyPercent = totalAvailableNights > 0 ? (bookedNights / totalAvailableNights) * 100 : 0`.

**8. Month phase** — `todayStrInTz = new Date().toLocaleDateString("en-CA", { timeZone })`. Phase A if `monthStartStr > todayStrInTz`, historical if `formatDate(monthEnd) < todayStrInTz`, else B.

**9. Pace index (Phase B only)** — `daysElapsed = round((todayUTC - monthStart)/86400000) + 1`. `paceIndex = daysElapsedPercent <= 0 ? 1.0 : occupancy / daysElapsedPercent`.

**10. Occupancy adjustment** — `tierIndex(occupancyPercent, occupancy_thresholds)`. If Phase B AND `paceIndex >= pace_index_bump_threshold` AND `occTier < occAdjustments.length - 1`, bump tier and set `paceIndexBumped = true`.

**11. Revenue for target month**:
- Phase A: `reservations` where `property_id = property_id`, status in confirmed/checked-in, `check_in_date >= monthStartStr AND < monthEndExclusiveStr`. Sum `total_price`.
- Phase B: `property_id = property_id`, statuses, `check_in_date < monthEndExclusiveStr AND check_out_date > monthStartStr`. Sum `total_price`.
- Historical: revenueTotal = 0, revenueAdj = 0.
- `revenueAchievementPercent = monthlyTarget > 0 ? (revenueTotal / monthlyTarget) * 100 : 0`.

**12. Revenue adjustment** — Choose phase A vs B array. `tierIndex` lookup. Apply conflict cap if `revenue > conflict_revenue_min` AND `occupancy < conflict_occupancy_max` AND `revAdj > conflict_cap`. Skip entirely (0) when target ≤ 0 or historical.

**13. Combine OR override**:
- Override `fixed_rate` → `value`; `percentage_adjustment` → `baseRate * (1 + value/100)`; `multiplier` → `baseRate * value`.
- Otherwise `baseRate * dowMultiplier * (1 + occAdj/100) * (1 + revAdj/100)`.

**14. Clamp (two layers)** — Layer 1: per-room-type min/max with `wasClamped` and `clampDirection`. Layer 2: if `finalRate <= 0`, fall back to `baseRate` (or `roomTypeMinRate` if baseRate also non-positive). Override results are also clamped.

**15. Round** — `round2(finalRate)`.

**16. Log** — Insert `pricing_log` row **only when `monthPhase === "A" || monthPhase === "B"`** (skip historical too — same CHECK constraint). Columns logged: `property_id, date_priced, target_month, month_phase, room_type, rate_plan_id, base_rate, calculated_rate, final_rate, day_of_week_multiplier, occupancy_percent, occupancy_tier, occupancy_adjustment_percent, pace_index, revenue_total, revenue_achievement_percent, revenue_adjustment_percent, room_type_min_rate, room_type_max_rate, was_clamped, clamp_direction, override_id, override_active`. When override is active, log dow=1 and adjustment percents=0 so the log clearly attributes the result to the override.

**17. Return** the JSON shape from the spec.

## Error handling
- 404: property missing, rate plan missing, no `rate_plan_prices` row.
- Outer `try/catch` → 500 with `{ success: false, error }` and `console.error`.

## Untouched
- All other edge functions (channex-full-sync, channex-daily-sync, channex-process-sync-queue, channex-booking-webhook, etc.).
- All database tables/schema.
- All frontend code.
- No `supabase/config.toml` changes.

## Safety checks
- Single declaration scan: `priceRow`, `dow`, `baseRate`, `monthStart`, `monthEnd`, `monthStartStr`, `monthEndExclusiveStr`, `revenueTotal`, `occTier`, `paceIndex`, `revenueAdjustmentPercent`, `finalRate`, `wasClamped`, `clampDirection`, `override`, `monthPhase` declared exactly once each.
- Verified columns exist in DB schema: `properties.weekend_days/off_peak_days/timezone`; `rate_plan_prices.weekday_rate/weekend_rate/off_peak_rate/min_rate/max_rate/unit_id/rate_plan_id/room_type`; `units.id/property_id/status`; `reservations.unit_id/check_in_date/check_out_date/property_id/total_price/status`; `pricing_overrides.property_id/override_date/room_type/override_type/value/id`; `pricing_rules.*` fields used; all `pricing_log` columns used.
- DOW branch order copied from `channex-full-sync/index.ts` lines 301–307.
- Reservation/units queries copied from `channex-full-sync/index.ts` lines 123–141.
