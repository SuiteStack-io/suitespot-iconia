

## Fix Channex Rate Plan Sync: One Rate Plan Per Room Type

### Problem
One PMS rate plan ("Standard 2 days min stay & 24 hrs in advance") has prices for 5 room types, but currently only creates ONE Channex rate plan (linked to Deluxe Suite). Channex requires a separate rate plan per room type.

### Root Cause
In `channex-sync-property` Step 3 (lines 251-306), the code maps one PMS rate plan to one Channex rate plan using `local_id = rp.id`. It picks the first matching room type and stops. It needs to loop through ALL room types and create a Channex rate plan for each.

### Current Data
- 1 PMS rate plan: `403a15cf...` ("Standard 2 days min stay & 24 hrs in advance")
- 5 `rate_plan_prices` rows (one per room type): Deluxe Suite ($108/$123), Double Room with Terrace ($110/$125), Family Suite ($120/$135), Junior Suite ($100/$115), Suite with Terrace ($110/$125)
- 5 synced room types in `channex_mappings`
- Only 1 rate plan mapping exists (linked to Deluxe Suite)

### Solution

#### Mapping Strategy
Since `channex_mappings.local_id` is uuid, we will use the `rate_plan_prices.id` as the `local_id` for rate plan mappings. Each `rate_plan_prices` row uniquely represents a rate plan + room type combination, which is exactly the 1:1 mapping Channex needs. The `channex_data` jsonb field will store the PMS rate plan ID and room type name for reference.

#### 1. Rewrite Step 3 of `channex-sync-property/index.ts`

Replace the current rate plan logic with:

```
For each active rate plan:
  Fetch all rate_plan_prices rows (where unit_id IS NULL) for this plan
  For each price row:
    Find the matching synced room type by display name
    Check if a mapping already exists for this price row ID
    If not:
      Create a Channex rate plan with:
        - title: rate plan name
        - property_id: channex property ID
        - room_type_id: channex room type ID for THIS room type
        - currency, sell_mode, rate_mode, options (as before)
      Save mapping: local_id = price_row.id, channex_data = { rate_plan_id, room_type }
      
      Push initial rates for next 365 days:
        - Monday-Thursday: weekday_rate (converted to cents)
        - Friday-Sunday: weekend_rate (converted to cents)
        - min_stay_arrival: from price row
```

#### 2. Add "Sync Rate Plans" button to `PropertySync.tsx`

Add a new button "Sync Missing Rate Plans" that:
- Calls a modified version of the sync that only does Step 3 (rate plans)
- Allows fixing missing rate plans without re-syncing property and room types

This will be implemented by adding a `mode` parameter to `channex-sync-property`:
- No mode / `"full"`: Current behavior (property + room types + rate plans)
- `"rate_plans_only"`: Skip property and room type creation, only sync rate plans

#### 3. Update `channex-create-rate-plan/index.ts`

Update the standalone function to also use `rate_plan_prices.id` as `local_id` instead of `rate_plan.id`, for consistency.

#### 4. Update `PropertySync.tsx` UI

- Add a "Sync Rate Plans" button next to the existing "Sync to Channex" button
- Show rate plan mappings with room type names (resolved from channex_data)
- Show which room types are missing rate plans

#### 5. Push Rates After Creation

After creating each rate plan in Channex, immediately push rates for the next 365 days using the Channex restrictions API (same endpoint as `channex-push-rates`). This happens inline in the sync function to avoid requiring a separate manual step.

---

### Files to Modify

| File | Action |
|------|--------|
| `supabase/functions/channex-sync-property/index.ts` | Rewrite Step 3 to create one rate plan per room type per PMS rate plan, push rates inline |
| `src/components/channex/PropertySync.tsx` | Add "Sync Rate Plans" button, show rate plan details with room type names |

No database migration needed -- we reuse existing `channex_mappings` table with `rate_plan_prices.id` as `local_id` and metadata in `channex_data`.

---

### Technical Details

**Rate push payload per room type** (sent to Channex `/api/v1/restrictions`):
```json
{
  "values": [
    {
      "property_id": "<channex_property_id>",
      "rate_plan_id": "<channex_rate_plan_id>",
      "date_from": "2026-02-18",
      "date_to": "2027-02-18",
      "days": { "mon": true, "tue": true, "wed": true, "thu": true },
      "rate": 10800,
      "min_stay_arrival": 2
    },
    {
      "property_id": "<channex_property_id>",
      "rate_plan_id": "<channex_rate_plan_id>",
      "date_from": "2026-02-18",
      "date_to": "2027-02-18",
      "days": { "fri": true, "sat": true, "sun": true },
      "rate": 12300,
      "min_stay_arrival": 2
    }
  ]
}
```

**Mapping storage example:**
- `local_id`: `<rate_plan_prices.id>` (the specific price row for "Standard" + "Junior Suite")
- `entity_type`: `"rate_plan"`
- `channex_id`: `<channex_rate_plan_uuid>`
- `channex_data`: `{ "rate_plan_id": "403a15cf...", "rate_plan_name": "Standard...", "room_type": "Junior Suite" }`
