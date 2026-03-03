

## Update InteractivePropertyMap & PropertyDetailsModal to Use rate_plan_prices

### Problem
Both components display `units.price_per_night` directly. They should resolve pricing from the `rate_plans` + `rate_plan_prices` system (PMS/Prices as source of truth).

### Approach
Both components are presentational — they receive data via props. The fix is to resolve rate plan pricing at the **call site** (parent pages) and pass the resolved price down, rather than adding Supabase calls inside these display components.

### Changes

**1. `src/components/InteractivePropertyMap.tsx`**
- Keep `price_per_night` in the `Property` interface (it will now be populated from rate plan data by the parent)
- No internal logic changes needed — it just renders `${price_per_night}/night`

**2. `src/components/PropertyDetailsModal.tsx`**
- Same: keep `price_per_night` in the interface, rendered by parent with resolved rate plan data
- Add optional `ratePlanName` prop to display which rate plan is active (e.g. "Summer Rate")

**3. `src/pages/Locations.tsx`** (parent of InteractivePropertyMap)
- After fetching units, resolve the default rate plan price for each unit's `unit_type` using `getActiveRate()` from `rateResolver.ts`
- Override each unit's `price_per_night` with the resolved `weekdayRate` before passing to the map component
- Fall back to `units.price_per_night` if no rate plan exists

**4. `src/pages/SelectionLanding.tsx`** (parent of PropertyDetailsModal)
- When a unit is selected for the modal, call `getActiveRate(unit.unit_type, new Date(), unit.id)` to resolve the current rate
- Override the `price_per_night` field on the property object passed to `PropertyDetailsModal`
- Add `ratePlanName` to the modal display

### Data flow
```text
Parent page fetches units
  → For each unit, getActiveRate(unit_type, today)
  → Overrides price_per_night with resolved weekdayRate
  → Falls back to units.price_per_night if no rate plan
  → Passes enriched data to component props
```

### Files to edit
- `src/pages/Locations.tsx` — resolve rate plan prices after fetching units
- `src/pages/SelectionLanding.tsx` — resolve rate plan price when opening modal
- `src/components/PropertyDetailsModal.tsx` — add optional `ratePlanName` display

