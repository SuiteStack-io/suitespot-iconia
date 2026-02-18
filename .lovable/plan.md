

## Restructure Rate Plans: One Rate Plan Per Room Type

### Overview

Currently there is 1 rate plan ("Standard 2 days min stay & 24 hrs in advance") with 5 entries in `rate_plan_prices` (one per room type). This needs to change so each room type has its own rate plan record, making Channex sync a simple 1-to-1 mapping.

### Current Data

| Rate Plan | Room Type | Weekday | Weekend | Min Stay |
|-----------|-----------|---------|---------|----------|
| Standard (single plan) | Deluxe Suite | $108 | $123 | 2 |
| Standard (single plan) | Double Room with Terrace | $110 | $125 | 2 |
| Standard (single plan) | Family Suite | $120 | $135 | 2 |
| Standard (single plan) | Junior Suite | $100 | $115 | 2 |
| Standard (single plan) | Suite with Terrace | $110 | $125 | 2 |

### After Migration

5 separate rate plans, each with 1 price entry:

| Rate Plan Name | Room Type | Weekday | Weekend |
|----------------|-----------|---------|---------|
| Standard Rate - Deluxe Suite | Deluxe Suite | $108 | $123 |
| Standard Rate - Double Room with Terrace | Double Room with Terrace | $110 | $125 |
| Standard Rate - Family Suite | Family Suite | $120 | $135 |
| Standard Rate - Junior Suite | Junior Suite | $100 | $115 |
| Standard Rate - Suite with Terrace | Suite with Terrace | $110 | $125 |

---

### Part 1: Database Migration

Add a `room_type` column to the `rate_plans` table to link each rate plan to exactly one room type name:

```
ALTER TABLE rate_plans ADD COLUMN room_type text;
```

Then run a data migration that:
1. For each `rate_plan_prices` row linked to the existing plan, creates a new `rate_plans` row named "Standard Rate - {Room Type}" with the `room_type` set
2. Creates a corresponding `rate_plan_prices` row for each new plan
3. Copies over the cancellation_policy, sell_mode, currency, extra_adult/child rates, and other metadata from the original plan
4. Deactivates (not deletes) the old combined plan to preserve audit history

The `room_type` column stores the `booking_com_name` string (e.g., "Deluxe Suite") -- not a foreign key, since room types are derived from units, not a dedicated table.

---

### Part 2: Redesign Prices Page (Group by Room Type)

Replace the current flat list of rate plan cards with a grouped view:

**Layout:**
```
Deluxe Suite (5 rooms)
  +-- Standard Rate: $108 weekday / $123 weekend, 2 night min  [Edit] [Delete]
  +-- [+ Add Rate Plan]

Family Suite (1 room)
  +-- Standard Rate: $120 weekday / $135 weekend, 2 night min  [Edit] [Delete]
  +-- [+ Add Rate Plan]
...
```

Each room type section is a collapsible card showing:
- Room type name and unit count
- All rate plans linked to that room type
- An "Add Rate Plan" button scoped to that room type

The existing `RatePlanDialog` will be simplified:
- Remove the multi-room-type pricing table (since each plan is for one room type)
- Show a single set of rate inputs: weekday rate, weekend rate, min stay
- Keep the auto-calculate weekend toggle
- Keep validity dates, cancellation policy, booking.com ID fields
- The `room_type` is pre-filled based on which room type's "+" button was clicked

---

### Part 3: Bulk Rate Plan Creation

Add a "Create Rate Plan for All Room Types" button at the top of the Prices page. When clicked, it opens a dialog that:

1. Asks for shared settings: plan name prefix (e.g., "Standard Rate"), min stay, cancellation policy
2. Shows a table of all room types with editable weekday/weekend rate fields
3. On save, creates one `rate_plans` + one `rate_plan_prices` row per room type in a single batch

This is a convenience feature for initial setup or seasonal plan creation.

---

### Part 4: Update Rate Resolver

The `rateResolver.ts` logic changes slightly:
- `getActiveRate(roomType, checkInDate, unitId?)` now filters `rate_plans` by `room_type = roomType` (in addition to checking `is_active` and date validity)
- The `rate_plan_prices` lookup becomes simpler since each plan has only one room type's prices
- Unit-specific overrides still work the same way (checking `unit_id` in `rate_plan_prices`)

---

### Part 5: Update Room Rates Page

The `RoomRates.tsx` page currently shows a plan selector with a table of all room types. It will be updated to:
- Show rate plans grouped by room type (matching the Prices page layout)
- Allow inline editing of rates per room type
- Remove the plan selector dropdown (no longer needed since plans are per room type)

---

### Part 6: Update Channex Sync

**`channex-sync-property/index.ts`** (Step 3 - Rate Plans):
- Currently tries to map rate plans to room types via `applicable_room_types` field
- Change to: read `rate_plan.room_type`, look up the corresponding Channex room type ID directly
- Each rate plan maps 1-to-1 to a Channex rate plan linked to one room type

**`channex-process-sync-queue/index.ts`** (Rate items):
- The `notify_channex_rate_change` trigger already uses `rate_plan_id` from the prices row
- The queue processor resolves `rate_plan_id` -> Channex rate plan ID (no change needed)

**`channex-push-rates/index.ts`**:
- No changes needed -- it already resolves rate_plan_id from mappings

---

### Part 7: Update Restrictions Page

The `Restrictions.tsx` page uses `applicable_room_types` for room applicability. This will be updated to use the new `room_type` column instead, showing which room type each rate plan applies to.

---

### Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | Add `room_type` column to `rate_plans`, migrate existing data |
| `src/pages/pms/Prices.tsx` | Redesign to group-by-room-type layout with bulk create |
| `src/components/pms/RatePlanCard.tsx` | Simplify for single-room-type display |
| `src/components/pms/RatePlanDialog.tsx` | Remove multi-room-type table, single rate input |
| `src/components/pms/RatePlanPricesTable.tsx` | Simplify or remove (prices shown inline) |
| `src/lib/rateResolver.ts` | Filter by `room_type` column |
| `src/pages/RoomRates.tsx` | Update to grouped layout |
| `src/pages/pms/Restrictions.tsx` | Use `room_type` instead of `applicable_room_types` |
| `supabase/functions/channex-sync-property/index.ts` | Use `rate_plan.room_type` for mapping |

### What Stays the Same

- `rate_plan_prices` table structure (no changes)
- `channex-push-rates` and `channex-push-availability` edge functions
- `channex-process-sync-queue` edge function
- Database triggers for Channex sync queue
- Unit-level price overrides mechanism
- Weekend rate auto-calculation logic
