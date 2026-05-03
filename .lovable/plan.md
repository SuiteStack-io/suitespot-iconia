## Fix primaryRatePlan query + add room type selector

### Changes to `src/pages/DynamicPricing.tsx` (PricingDashboard component only)

**1. State (line 1121)** — replace `primaryRatePlan` with two states:
```ts
const [activeRatePlans, setActiveRatePlans] = useState<Array<{ id: string; room_type: string; name: string }>>([]);
const [selectedRatePlan, setSelectedRatePlan] = useState<{ id: string; room_type: string } | null>(null);
```

**2. Rate plan query (lines 1163–1170)** — replace the broken `rate_plans.room_type` query (column is null on that table) with the joined query that filters out archived plans and pulls `room_type` from `rate_plan_prices` (property-wide rows only, `unit_id IS NULL`):
```ts
const { data: ratePlanRows } = await supabase
  .from('rate_plans')
  .select('id, name, rate_plan_prices!inner(room_type)')
  .eq('property_id', propertyId)
  .eq('is_active', true)
  .not('name', 'ilike', '%archived%')
  .is('rate_plan_prices.unit_id', null)
  .order('created_at', { ascending: true });
```
Then map each row → `{ id, room_type: priceRows[0].room_type, name }`, filter out null `room_type`, and on commit (line 1299) call `setActiveRatePlans(plans)` and `setSelectedRatePlan(prev => prev ?? (plans[0] ? { id: plans[0].id, room_type: plans[0].room_type } : null))`.

**3. Preview cache key (lines 1313–1347)** — key the cache by month + rate plan id:
- Replace the `loadPreview` effect to depend on `selectedRatePlan` and use `previewKey = ${selectedMonth}_${selectedRatePlan?.id}`.
- Skip if `!selectedRatePlan`. Send `room_type: selectedRatePlan.room_type` and `rate_plan_id: selectedRatePlan.id` to the batch function.
- Store/read via `previewByMonth[previewKey]`.
- Update `previewRows` getter to read `previewByMonth[`${selectedMonth}_${selectedRatePlan?.id}`] ?? []`.
- Effect deps: `[selectedMonth, selectedRatePlan, propertyId, monthSummaries, previewByMonth]`.

**4. Header + selector (lines 1438–1444)** — render a Select beside the title:
```
Rate Preview — May 2026 · Family Suite     [Select dropdown]
```
The Select lists `activeRatePlans` by `name` (or `room_type` if name is generic), value = `id`. On change, set `selectedRatePlan` to the matching `{ id, room_type }`. Header room-type label sources from `selectedRatePlan.room_type`.

**5. Empty states (lines 1446–1497)**:
- If `activeRatePlans.length === 0`: render `"No active rate plans configured for this property"` instead of the table.
- Keep the existing in-table "No preview data available" only when a plan is selected but rows are empty.

### Imports
Add `Select, SelectTrigger, SelectValue, SelectContent, SelectItem` from `@/components/ui/select` if not already imported in this file.

### Out of scope
- No changes to the batch Edge Function, helper module, month cards aggregation, settings card, or any other page.

### Duplicate-declaration check
- `selectedRatePlan` / `activeRatePlans` are new — confirmed no existing identifiers with those names in the file.
- `previewKey` is local to the effect and the render scope; declared once in each.
