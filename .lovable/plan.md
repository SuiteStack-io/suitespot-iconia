

## Migrate BookingFlow Pricing to rate_plan_prices (PMS/Prices as Source of Truth)

### Problem
BookingFlow currently reads `units.price_per_night` and `units.weekend_rate` directly from the units table for all pricing calculations. It should instead use the rate plan system (`rate_plans` + `rate_plan_prices`) managed via PMS/Prices.

### Approach
Use the existing `getActiveRate()` from `src/lib/rateResolver.ts` which already resolves the correct rate plan for a room type and date, with unit-specific override support.

### Changes — Single file: `src/pages/BookingFlow.tsx`

**1. Add rate plan state and fetching**
- Import `getActiveRate` from `@/lib/rateResolver.ts`
- Add state: `ratePlanRate` storing `{ weekdayRate, weekendRate, minStay, ratePlanName, ratePlanId } | null`
- When `selectedUnit` or `dateRange.from` changes, call `getActiveRate(unit.unit_type, dateRange.from, selectedUnit)` and store the result
- If no rate plan found, fall back to `units.price_per_night` / `units.weekend_rate` for backward compatibility

**2. Update pricing calculations**
- `calculateSubtotal()`: Use `ratePlanRate.weekdayRate` / `ratePlanRate.weekendRate` instead of `unit.price_per_night` / `unit.weekend_rate`
- `getRateBreakdown()`: Same swap
- `calculateThirdGuestFee()`: Fetch `extra_adult_rate` from the matched rate plan (default $50)

**3. Update reservation insert**
- `price_per_night` field: Use the resolved weekday rate from rate plan instead of `unit.price_per_night`

**4. Update UI display**
- Suite type dropdown (line ~1118): Show rate plan weekday rate instead of `sample_unit.price_per_night`
- Pricing card (lines ~1181-1219): Use resolved rates for display
- Remove `price_per_night` and `weekend_rate` from the Unit interface and Supabase select queries (no longer needed for pricing; keep `tax_percentage`)

**5. Minimum stay enforcement**
- Use `ratePlanRate.minStay` to validate the selected date range meets minimum stay requirements

### Data flow
```text
User selects unit type + dates
  → getActiveRate(unit_type, check_in_date, unit_id)
    → Finds matching rate_plan (date-specific or default)
    → Returns weekday_rate, weekend_rate, min_stay from rate_plan_prices
  → BookingFlow uses these rates for all calculations
```

### Backward compatibility
If `getActiveRate` returns null (no rate plan configured for this room type), fall back to `units.price_per_night` / `units.weekend_rate` to avoid breaking existing bookings for room types not yet set up in PMS/Prices.

