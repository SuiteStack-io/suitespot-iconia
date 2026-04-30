## Goal

Extract the dynamic-pricing math from `supabase/functions/calculate-dynamic-price/index.ts` into a pure shared helper, then refactor the existing Edge Function to delegate to it. No sync functions are touched in this prompt.

## Files

**Created**
- `supabase/functions/_shared/dynamic-pricing.ts` — pure helper, no Supabase imports, no network. Exports `calculateDynamicRate`, `computeMonthBounds`, `computeMonthPhase`, and the `DynamicPricingContext` / `DynamicPricingInput` / `DynamicPricingResult` types.

**Modified**
- `supabase/functions/calculate-dynamic-price/index.ts` — becomes a thin loader: fetches data, builds context, delegates math, then handles `pricing_log` insert + HTTP response.

**Not touched** (deferred to next prompt)
- `channex-full-sync`, `channex-daily-sync`, `channex-process-sync-queue`, `channex-push-rates`.

## Helper behavior

Logic ported 1-for-1 from the existing Edge Function:
- Base rate (off-peak / weekend / weekday) using property `weekend_days` and `off_peak_days`.
- Static fast path when `pricing_rules` is missing or `is_enabled = false` → returns clamped rate, no log.
- Manual override match (room-type-specific beats wildcard).
- Day-of-week multiplier.
- Occupancy %, month phase (A / B / historical), pace index + pace bump.
- Revenue achievement %, phase-aware revenue adjustment, conflict cap.
- Combine OR override.
- Promotion selection: largest savings, tie-break by newest `created_at`, percent vs fixed math.
- Two-layer clamp + zero-guard, `round2` final.

### Lazy month cache (the clarification)

`ctx.monthlyBookedNightsByMonth` and `ctx.monthlyRevenueByMonth` are keyed by `'YYYY-MM'`. For each, the helper:
1. Checks if the target month key is already populated → use it.
2. Otherwise computes from `ctx.reservations` and writes back.

This makes the same helper work for both calling paths:
- **Edge Function path:** caller pre-seeds both caches via SQL → helper just reads.
- **Sync path:** caller passes empty `{}` caches plus a broad `ctx.reservations` array → helper computes once per month and reuses.

### Single source of truth

`computeMonthPhase(targetDate, todayStrInTz)` is exported so the Edge Function uses it for cache pre-seeding and the helper uses it for tier logic — no duplicated phase math.

## Edge Function refactor

Steps inside `Deno.serve`:
1. CORS, JSON parse, input validation (unchanged).
2. Load `properties` row → 404 if missing.
3. Compute `todayStrInTz` via `Intl` in property timezone.
4. Validate `rate_plans` row → 404.
5. Load `rate_plan_prices` (room-type level → fallback any) → 404 if neither.
6. Load `pricing_rules` for the property.
7. Load `pricing_overrides` for `(property_id, override_date = target_date)`.
8. Load `units` `(id)` filtered by `property_id` and `status != 'maintenance'`.
9. Use `computeMonthBounds` + `computeMonthPhase` to derive bounds and phase.
10. Run the existing occupancy reservation query and the existing phase-aware revenue query — exact same SQL as today.
11. Pre-compute `bookedNightsSeed` and `revenueSeed` and pass them as the only entries in the month caches.
12. Load active `promotional_periods` matching `(property_id, is_active, booking_window, stay_window)`.
13. Build `DynamicPricingContext`, call `calculateDynamicRate(ctx, { room_type, rate_plan_id, target_date, priceRow })`.
14. If result is `static` → return existing static JSON shape, no log.
15. If result is `dynamic` and `month_phase ∈ {A,B}` → insert `pricing_log` row with the same column set as today.
16. Return existing JSON response shape (no client-visible changes).

## Verification

- Dashboard "Preview pricing" returns identical numbers for the same `(property, room_type, rate_plan, date)`.
- `pricing_log` rows still inserted only when `month_phase ∈ {A,B}`.
- Static fast path still emits zero log rows.
- Helper has no imports of Supabase or Deno APIs.
- No duplicate variable declarations in either file.
