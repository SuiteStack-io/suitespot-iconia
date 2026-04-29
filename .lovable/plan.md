# Promotional Periods feature

Operator-facing module to schedule date-range discounts that stack on top of dynamic pricing and flow to OTAs through the existing rate-push pipeline.

## Scope note
The spec references "Prompt 4" (sync-function pre-load), "Prompt 5" (Pricing Dashboard "Promo" badge), and "Prompt 6" (Override UI) as **future work**. Sync functions today push static `rate_plan_prices` and don't call `calculate-dynamic-price`, so the pre-load query has no consumer yet — it ships with Prompt 4. The dashboard badge ships with Prompt 5. This plan delivers everything else: table, page, dialog, and the `calculate-dynamic-price` integration.

## 1. Migration

New table `public.promotional_periods` exactly as specified, plus:
- `ALTER TABLE public.pricing_log ADD COLUMN promotion_id UUID REFERENCES public.promotional_periods(id)`
- `ALTER TABLE public.pricing_log ADD COLUMN promotion_discount_percent NUMERIC(5,2)`

Policies (matches `pricing_overrides` pattern from migration `20260412100714_…`):
- `SELECT`: `USING (true)` to `public`
- `INSERT/UPDATE/DELETE`: `authenticated`, gated by `user_has_property_access(property_id, 'manager')`

Trigger: `BEFORE UPDATE … EXECUTE FUNCTION public.update_updated_at_column()`.

Index: `CREATE INDEX idx_promotional_periods_lookup ON public.promotional_periods (property_id, is_active, stay_start, stay_end)`.

## 2. New page `src/pages/Promotions.tsx`

Same shell as `DynamicPricing.tsx`: `SlideMenu` + `AdminBreadcrumb` + `usePropertyId()`.

- **A. OTA Limitation Notice** — muted info box with the exact copy from the spec
- **B. Active & Upcoming card** — header row with "Create Promotion" button on the right; lists rows where `booking_window_end >= today`, sorted by `booking_window_start ASC`. Each row shows:
  - Bold name + status `Badge` (Active green / Upcoming blue / Expired gray)
  - `-{value}% off` or `-{currencySymbol}{value} off` (currency from active property)
  - "Bookable: {start} – {end}" and "For stays: {start} – {end}" formatted with `date-fns`
  - Optional "Min stay: N nights" and "Room types: A, B" lines
  - Edit button, `Switch` for `is_active`, Delete (confirm via `AlertDialog`)
- **C. Past Promotions** — `Collapsible` (component already present at `src/components/ui/collapsible.tsx`) with rows where `booking_window_end < today`, read-only

## 3. Routing & nav

- `src/App.tsx`: import `Promotions` and add `<Route path="/promotions" element={<ProtectedRoute><AdminRoute><Promotions /></AdminRoute></ProtectedRoute>} />` directly after the `/dynamic-pricing` route
- `src/components/SlideMenu.tsx`: add `{ title: 'Promotions', url: '/promotions', icon: Tag, showFor: ['admin'] }` directly after the Dynamic Pricing entry in the PMS section; import `Tag` from `lucide-react`

## 4. Create/Edit dialog (in-file in `Promotions.tsx`)

Built from `Dialog`, `Input`, `Textarea`, `RadioGroup`, `Label`, `Calendar`/`Popover`. Same UI primitives used across the codebase — no new deps.

Fields exactly as specified. Defaults:
- Booking window: today and today+90
- Stay window: today+30 and today+180

Room types: one-shot query at dialog open
```ts
supabase.from('units')
  .select('booking_com_name')
  .eq('property_id', propertyId)
  .not('booking_com_name', 'is', null);
```
Dedupe client-side; render as a checkbox list inside a `Popover`. Empty selection → store `null` (= "all room types").

Validation:
- Required: name, both window date pairs, discount value
- `booking_window_end >= booking_window_start`, `stay_end >= stay_start`
- Percentage: in `1..50`; fixed: `> 0`
- `min_stay`: blank → `null`, else positive integer
- `created_by = auth.uid()`

`insert` for create, `update` for edit, then refetch + toast.

## 5. Edge function: `calculate-dynamic-price` integration

Single file edit: `supabase/functions/calculate-dynamic-price/index.ts`.

Insertion point: between current step 12 (combine / override) and step 13 (clamp), so the flow becomes:
```text
calculatedRate = base × dow × occ × rev   (or override if present)
        ↓
   apply promotion (skipped if overrideActive)
        ↓
   clamp to room-type min/max
        ↓
   layer-2 safety
```

### Code shape

- Promote the existing `todayStrInTz` derivation to right after the property load so it's reusable. Today's `const todayStrInTz = …` further down is removed (single declaration to avoid the duplicate-variable rule).
- New locals declared once near the top of the try block: `let appliedPromotionId: string | null = null;` and `let appliedPromotionDiscountPercent: number | null = null;`
- After override resolution, run **only when `!overrideActive`**:

```ts
const { data: matchingPromos } = await supabase
  .from('promotional_periods')
  .select('id, discount_type, discount_value, room_types')
  .eq('property_id', property_id)
  .eq('is_active', true)
  .lte('booking_window_start', todayStrInTz)
  .gte('booking_window_end', todayStrInTz)
  .lte('stay_start', target_date)
  .gte('stay_end', target_date);

const candidates = (matchingPromos ?? [])
  .filter((p: any) => !p.room_types || p.room_types.includes(room_type))
  .map((p: any) => {
    const v = Number(p.discount_value);
    const savings = p.discount_type === 'percentage' ? calculatedRate * v / 100 : v;
    return { promo: p, savings };
  })
  .sort((a, b) => b.savings - a.savings || Number(b.promo.discount_value) - Number(a.promo.discount_value));

const winner = candidates[0];
if (winner && winner.savings > 0) {
  const preDiscount = calculatedRate;
  if (winner.promo.discount_type === 'percentage') {
    calculatedRate = preDiscount * (1 - Number(winner.promo.discount_value) / 100);
    appliedPromotionDiscountPercent = round2(Number(winner.promo.discount_value));
  } else {
    calculatedRate = preDiscount - Number(winner.promo.discount_value);
    appliedPromotionDiscountPercent = preDiscount > 0 ? round2(winner.savings / preDiscount * 100) : null;
  }
  appliedPromotionId = winner.promo.id;
}
```

`min_stay` is **not** applied here — `calculate-dynamic-price` is per-night and has no stay-length context. `min_stay` will be enforced as a Channex restriction by the existing restrictions push pipeline (out of scope, documented with an inline comment).

The existing clamp block remains unchanged — if the discounted rate falls below `room_type_min_rate`, it already sets `was_clamped = true, clamp_direction = 'floor'`, satisfying the spec.

### Logging
Existing `pricing_log.insert(...)` (only runs for phase A/B) gains:
```ts
promotion_id: appliedPromotionId,
promotion_discount_percent: appliedPromotionDiscountPercent,
```

### Response
Add `promotion_applied: appliedPromotionId ? { id: appliedPromotionId, discount_percent: appliedPromotionDiscountPercent } : null` inside `adjustments` so future callers (sync functions, dashboard) can surface it without a second query.

## 6. Out of scope (per spec — deferred prompts)

- Pre-load promotions inside `channex-full-sync`, `channex-daily-sync`, `channex-process-sync-queue` (Prompt 4)
- "Promo" badge on the Pricing Dashboard's Rate Preview Table (Prompt 5)
- Override UI changes (Prompt 6) — overrides take precedence and remain untouched
- `pricing_overrides`, `rate_plan_prices`, channel markup, Dynamic Pricing page settings, every other edge function and page

## 7. Files

Created:
- `supabase/migrations/<timestamp>_promotional_periods.sql`
- `src/pages/Promotions.tsx`

Edited:
- `src/App.tsx` (route)
- `src/components/SlideMenu.tsx` (nav entry + `Tag` import)
- `supabase/functions/calculate-dynamic-price/index.ts` (promotion lookup + apply + log fields + response field; promote `todayStrInTz` declaration)
