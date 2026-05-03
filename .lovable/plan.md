## Pricing Dashboard for Dynamic Pricing page (revised)

### Files

**Created**
- `supabase/functions/calculate-dynamic-price-batch/index.ts` — new batch endpoint.

**Modified**
- `src/pages/DynamicPricing.tsx` — add Pricing Dashboard section below the existing settings card.

**Not touched**
- `supabase/functions/calculate-dynamic-price/index.ts` (single-date, keeps logging)
- `supabase/functions/_shared/dynamic-pricing.ts`
- DB tables, RoomRates, Analytics, SlideMenu, routing.

### 1. New Edge Function: `calculate-dynamic-price-batch`

Request body: `{ property_id, room_type, rate_plan_id, date_from, date_to }` (YYYY-MM-DD inclusive).

Behavior — single set of pre-loads, mirrors `calculate-dynamic-price/index.ts` exactly:
1. CORS, validate inputs.
2. Load `properties` (id, weekend_days, off_peak_days, timezone). Compute `todayStrInTz` via `Intl`.
3. Validate `rate_plans` row.
4. Load `rate_plan_prices` for `(rate_plan_id, room_type)` — room-type level → fallback any.
5. Load `pricing_rules` for property.
6. Load `units` (id) where `property_id = propertyId AND status != 'maintenance'`.
7. Load `pricing_overrides` for property where `override_date BETWEEN date_from AND date_to`.
8. Load `promotional_periods` matching `(property_id, is_active = true, booking_window covers today, stay window overlaps [date_from, date_to])`.
9. Load reservations across the union of every month touched by `[date_from, date_to]` — same shape and filters as the single-date function (the helper uses lazy month caches so no pre-seeding needed; pass empty `monthlyBookedNightsByMonth` and `monthlyRevenueByMonth = {}`).
10. Build one `DynamicPricingContext`.
11. Loop dates from `date_from` to `date_to` inclusive; for each date filter `overrides` to that date and call `calculateDynamicRate(ctx, { room_type, rate_plan_id, target_date: ds, priceRow })`.
12. Return `{ success: true, rates: [{ target_date, base_rate, final_rate, adjustments: { day_of_week_multiplier, occupancy_percent, occupancy_adjustment, revenue_adjustment, month_phase, override_active, was_clamped, clamp_direction, promotion_applied } }] }`.
13. **Never** insert into `pricing_log`.

`verify_jwt` follows the project default for managed functions.

### 2. `src/pages/DynamicPricing.tsx` additions

Inserted after the existing settings card, before the Pace info dialog.

#### State
```
const [dashboardLoading, setDashboardLoading] = useState(false);
const [propertyMeta, setPropertyMeta] = useState<{ timezone: string; weekend_days: number[]; off_peak_days: number[] } | null>(null);
const [primaryRatePlan, setPrimaryRatePlan] = useState<{ id: string; room_type: string } | null>(null);
const [monthSummaries, setMonthSummaries] = useState<MonthSummary[]>([]);
const [selectedMonth, setSelectedMonth] = useState<string>(/* current YYYY-MM in property tz */);
const [previewByMonth, setPreviewByMonth] = useState<Record<string, PreviewRow[]>>({});
const [previewLoading, setPreviewLoading] = useState(false);
```

`MonthSummary` includes: `key (YYYY-MM)`, `label`, `monthStart`, `monthEndExclusive`, `phase ('B' | 'A')`, `bookedNights`, `totalAvailableNights`, `occupancyPercent`, `paceIndex | null`, `revenueTotal`, `revenueTarget | null`, `occAdjustmentPercent`, `revAdjustmentPercent`, `overridesCount`.

#### Cards data load (single effect on `[propertyId, rules?.id]`)
- Load property meta (`timezone`, `weekend_days`, `off_peak_days`).
- Compute `todayStrInTz` and the 6 month windows (current + next 5).
- Pick `primaryRatePlan`: first row from `rate_plans` where `property_id = propertyId` ordered by `created_at ASC`, selecting `id, room_type`.
- Active units: `units` where `property_id = propertyId AND status != 'maintenance'`.
- Reservations across the entire 6-month window: `reservations` select `unit_id, property_id, status, check_in_date, check_out_date, total_price` where `status IN ('confirmed','checked-in') AND check_in_date < windowEndExclusive AND check_out_date > windowStart AND unit_id IN (activeUnitIds)`.
- Overrides: `pricing_overrides` where `property_id = propertyId AND override_date >= windowStart AND override_date < windowEndExclusive`.

For each month, compute (in TS, mirroring `_shared/dynamic-pricing.ts`):
- `bookedNights`: same overlap math (`computeBookedNightsFromReservations` equivalent) — overlap of each reservation with the month window.
- `totalAvailableNights = activeUnitsCount * daysInMonth`.
- `occupancyPercent = bookedNights / totalAvailableNights * 100`.
- `phase`: month containing `todayStrInTz` → `'B'`; later months → `'A'`.
- `paceIndex` (Phase B only): `(occupancyPercent) / ((daysElapsed / daysInMonth) * 100)` where `daysElapsed = (today - monthStart days) + 1`.
- `revenueTotal`: **Issue 3 fix** — use the same logic as the helper, branched on phase:
  - Phase A: sum `total_price` where `check_in_date >= monthStart AND check_in_date < monthEndExclusive`.
  - Phase B: sum `total_price` where `check_in_date < monthEndExclusive AND check_out_date > monthStart`.
- `revenueTarget = rules.monthly_revenue_target`.
- `occAdjustmentPercent`: tier from `rules.occupancy_thresholds` / `rules.occupancy_adjustments` based on `occupancyPercent`, with pace-bump tier+1 in Phase B if `paceIndex >= rules.pace_index_bump_threshold`.
- `revAdjustmentPercent`: tier from `rules.revenue_thresholds` and the phase-appropriate adjustments array (`revenue_adjustments_phase_a` for Phase A, `revenue_adjustments_phase_b` for Phase B), with the conflict-cap rule applied (`revenue_occupancy_conflict_*`).
- `overridesCount`: count of overrides in `[monthStart, monthEndExclusive)`.

If `rules.is_enabled === false` we still show the cards but `occAdjustmentPercent` / `revAdjustmentPercent` are 0 and pace index is hidden.

#### Card UI
Horizontal `overflow-x-auto` row of 6 `<Card>` elements. Active month gets a green outline + "Active" badge; future months get "Future" (blue badge). Click selects the card → updates `selectedMonth`. Inside each card:
- Title `"<MonthName> <Year>"`
- Phase badge
- "Occupancy: 72%" + `<Progress value={pct} />`
- Pace Index (active only): `"Pace 1.4x"`
- Revenue (when target set): `"$6,800 / $8,000 target"` + progress bar (visual cap 100%)
- Active adjustment: `"+18% occ, +10% rev"`
- `"{n} manual override{s}"`

#### Rate Preview Table
Below cards, scoped to `selectedMonth`. Columns: `Date | Day | Base Rate | Day Mult | Occ Adj | Rev Adj | Final Rate | Override`.

Loading rule on `[selectedMonth, primaryRatePlan?.id]`:
- If `previewByMonth[selectedMonth]` already cached → render immediately.
- Else if `primaryRatePlan` exists → set `previewLoading = true`, call `supabase.functions.invoke('calculate-dynamic-price-batch', { body: { property_id, room_type, rate_plan_id, date_from: monthStart, date_to: monthEndInclusive } })`. On success, store rows in `previewByMonth[selectedMonth]`.
- Else render empty state "No rate plan configured for this property".

Each row uses fields from the batch response:
- `Base Rate` = `base_rate`
- `Day Mult` = `adjustments.day_of_week_multiplier` (`×N.NN`)
- `Occ Adj` = `adjustments.occupancy_adjustment` (`+N%`)
- `Rev Adj` = `adjustments.revenue_adjustment`
- `Final Rate` = `final_rate`
- `Override` = badge if `adjustments.override_active`

Tinting:
- `bg-blue-50/40` if override
- else `bg-green-50/40` if `final_rate > base_rate`
- else `bg-orange-50/40` if `final_rate < base_rate`

Read-only — no inputs anywhere.

### Constraints / hygiene
- No duplicate variable declarations (re-uses `propertyId`, `rules`, etc., from outer scope; new state names are unique).
- All queries reuse exact column names that exist in the schema.
- No changes to `pricing_log` write paths.
