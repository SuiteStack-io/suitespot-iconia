# Build shared dynamic-pricing helper + refactor calculate-dynamic-price

Two files only. No sync functions touched.

## File 1: `supabase/functions/_shared/dynamic-pricing.ts` (NEW)

Pure module — no `Deno.serve`, no I/O, no Supabase client. Exports:

- `DynamicPricingContext` — `{ property: { id, weekend_days, off_peak_days, timezone }, pricingRules, reservations, units, overrides, promotions, todayStrInTz, monthlyRevenueByMonth, monthlyBookedNightsByMonth }`
- `DynamicPricingInput` — `{ target_date, room_type, rate_plan_id, weekday_rate, weekend_rate, off_peak_rate, min_rate, max_rate }`
- `DynamicPricingResult` — `{ base_rate, final_rate_cents, final_rate (dollars), month_phase, base_rate_dollars, calculated_rate, day_of_week_multiplier, occupancy_percent, occupancy_tier, occupancy_adjustment_percent, pace_index, pace_index_bumped, revenue_total, revenue_achievement_percent, revenue_adjustment_percent, room_type_min_rate, room_type_max_rate, was_clamped, clamp_direction, override_id, override_active, promotion_id, promotion_discount_percent, static_reason }`
- `calculateDynamicRate(ctx, input): DynamicPricingResult`

Implementation = literal port of `calculate-dynamic-price/index.ts` lines 140–504, with these mechanical substitutions:

| Original (calculate-dynamic-price) | Helper version |
|---|---|
| properties query (83–87) | `ctx.property` |
| rate_plans lookup (102–110) | trusted `input.rate_plan_id` |
| rate_plan_prices lookup (112–138) | `input.weekday_rate / weekend_rate / off_peak_rate / min_rate / max_rate` |
| pricing_rules query (168–172) | `ctx.pricingRules` |
| static-disabled early return (178–215) | kept as defensive fallback returning a valid `DynamicPricingResult` with `static_reason` populated |
| pricing_overrides query (218–222) | `ctx.overrides.filter(o => o.override_date === input.target_date)` |
| units query (254–258) | `ctx.units` |
| month reservations (266–272) | filter `ctx.reservations` for month overlap; result cached in `ctx.monthlyBookedNightsByMonth[YYYY-MM]` (one pass per month, not per date) |
| month revenue (343–367) | filter `ctx.reservations` by month; cached in `ctx.monthlyRevenueByMonth[YYYY-MM]` |
| promotional_periods query (443–451) | filter `ctx.promotions` in JS: `is_active !== false` AND `booking_window_start <= todayStrInTz <= booking_window_end` AND `stay_start <= target_date <= stay_end` AND `(!room_types || room_types.includes(room_type))` |
| pricing_log.insert (506–533) | removed — caller batches |

Byte-identical otherwise: dow branch order (off-peak → weekend → weekday), `tierIndex`, `formatDate`/`addDays`/`daysInMonth`/`round2` helpers, override precedence (specific room_type before wildcard; override skips dow/occ/revenue/promotion), promotion winner (largest `savings`, then most recently created), pace-index bump logic, revenue-occupancy conflict cap, two-layer clamp + zero-floor safety. `final_rate_cents = Math.round(finalRate * 100)`.

## File 2: `supabase/functions/calculate-dynamic-price/index.ts` (REFACTOR)

Keep the entire HTTP/auth/data-loading shell. Replace the inline calculation (lines ~140–504) with a single call to `calculateDynamicRate`.

Changes:

1. Add `import { calculateDynamicRate, DynamicPricingContext, DynamicPricingInput } from "../_shared/dynamic-pricing.ts";` at the top.

2. Keep all DB loading exactly as-is:
   - properties (line 83) — already selects `id, weekend_days, off_peak_days, timezone`
   - rate_plans (line 103) + null-check
   - rate_plan_prices: keep both attempts (unit-level null first, then any) so behavior matches
   - pricing_rules (line 168)
   - pricing_overrides (line 218)
   - units (line 254)
   - reservations for occupancy (266)
   - reservations for revenue (343/355)
   - promotional_periods (443) — but expand the select to also include `stay_start, stay_end, booking_window_start, booking_window_end, is_active` so the helper can re-filter (the helper expects the full row shape)

3. After loading, build:
   ```ts
   const ctx: DynamicPricingContext = {
     property: {
       id: property_id,
       weekend_days: propertyWeekendDays,
       off_peak_days: propertyOffPeakDays,
       timezone: propertyTimezone,
     },
     pricingRules: rules,
     reservations: [...occupancyReservations, ...revenueReservations].dedupedById, // see note
     units: allUnits || [],
     overrides: overrideMatches || [],
     promotions: matchingPromos || [],
     todayStrInTz,
     monthlyRevenueByMonth: { [target_date.slice(0,7)]: revenueTotal },   // pre-seed so helper uses same value
     monthlyBookedNightsByMonth: { [target_date.slice(0,7)]: bookedNights }, // pre-seed
   };
   const input: DynamicPricingInput = {
     target_date, room_type, rate_plan_id,
     weekday_rate: Number(priceRow.weekday_rate),
     weekend_rate: priceRow.weekend_rate != null ? Number(priceRow.weekend_rate) : Number(priceRow.weekday_rate),
     off_peak_rate: priceRow.off_peak_rate != null ? Number(priceRow.off_peak_rate) : 0,
     min_rate: priceRow.min_rate != null ? Number(priceRow.min_rate) : null,
     max_rate: priceRow.max_rate != null ? Number(priceRow.max_rate) : null,
   };
   const result = calculateDynamicRate(ctx, input);
   ```

   **Pre-seeding the monthly caches** with values the existing edge function already computed guarantees byte-identical results (the helper would otherwise recompute them from the reservations array, but only the target month's reservations were loaded — pre-seeding sidesteps that entirely).

4. Insert the pricing_log row using `result` fields (only when `result.month_phase === 'A' || 'B'` and `!result.static_reason`):
   ```ts
   await supabase.from("pricing_log").insert({
     property_id, date_priced: target_date, target_month: target_date.slice(0,7),
     month_phase: result.month_phase, room_type, rate_plan_id,
     base_rate: result.base_rate, calculated_rate: result.calculated_rate, final_rate: result.final_rate,
     day_of_week_multiplier: result.day_of_week_multiplier,
     occupancy_percent: result.occupancy_percent, occupancy_tier: result.occupancy_tier,
     occupancy_adjustment_percent: result.occupancy_adjustment_percent,
     pace_index: result.pace_index,
     revenue_total: result.revenue_total, revenue_achievement_percent: result.revenue_achievement_percent,
     revenue_adjustment_percent: result.revenue_adjustment_percent,
     room_type_min_rate: result.room_type_min_rate, room_type_max_rate: result.room_type_max_rate,
     was_clamped: result.was_clamped, clamp_direction: result.clamp_direction,
     override_id: result.override_id, override_active: result.override_active,
     promotion_id: result.promotion_id, promotion_discount_percent: result.promotion_discount_percent,
   });
   ```

5. Return the same response shape:
   ```ts
   return respond(200, {
     success: true,
     base_rate: result.base_rate,
     final_rate: result.final_rate,
     adjustments: {
       day_of_week_multiplier: result.day_of_week_multiplier,
       occupancy_percent: result.occupancy_percent,
       occupancy_adjustment: result.occupancy_adjustment_percent,
       pace_index: result.pace_index,
       pace_index_bumped: result.pace_index_bumped,
       revenue_achievement_percent: result.revenue_achievement_percent,
       revenue_adjustment: result.revenue_adjustment_percent,
       month_phase: result.month_phase,
       room_type_min_rate: result.room_type_min_rate,
       room_type_max_rate: result.room_type_max_rate,
       override_active: result.override_active,
       was_clamped: result.was_clamped,
       clamp_direction: result.clamp_direction,
       promotion_applied: result.promotion_id
         ? { id: result.promotion_id, discount_percent: result.promotion_discount_percent }
         : null,
     },
   });
   ```

   Static-disabled fast-path early-return at lines 194–215 stays as-is (it returns BEFORE reaching the helper call), preserving its exact existing response shape and skipping the pricing_log insert.

## Variable hygiene

- `result` is the only new local; all existing locals (`baseRate`, `weekdayRate`, `override`, `bookedNights`, `revenueTotal`, etc.) are READ to build `ctx`/`input` and then no longer assigned. No re-declarations.
- The helper uses its own internal locals (`baseRate`, `dow`, etc.) — they're function-scoped, no collision with the edge function's outer scope.

## Out of scope (this prompt)

- channex-full-sync, channex-daily-sync, channex-process-sync-queue, channex-push-rates — untouched.
- Database schema, RLS, frontend.

## Verification

The dashboard preview already calls `calculate-dynamic-price`. After refactor, run a preview from the Dynamic Pricing page → response and pricing_log row must match a pre-refactor run for the same inputs. If they match, the helper is proven equivalent and ready for sync-pipeline integration in a follow-up prompt.
