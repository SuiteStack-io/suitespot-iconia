

## Derived Rate Plan Support for Channex OTA Markup

### Overview

Add the ability to set a markup percentage per OTA channel (e.g., +18% for Booking.com). The system will automatically create **derived rate plans** in Channex that inherit the base rate and apply the markup. OTAs see the marked-up price; the PMS tracks the net base rate internally.

### Current State

- 5 active base rate plans, all synced to Channex as `manual` rate plans
- Channex mappings stored in `channex_mappings` table (entity_type: `rate_plan`)
- Rate creation handled by `channex-create-rate-plan` edge function
- Rate pushes handled by `channex-push-rates` edge function
- Channex API supports `rate_mode: "derived"` with `parent_rate_plan_id` and `derived_option` containing `increase_by_percent` rules

---

### Phase 1: Database Tables

**New table: `channel_markup_settings`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Default: gen_random_uuid() |
| channel_name | text | e.g., "Booking.com" |
| channel_id | text (nullable) | Channex channel UUID |
| markup_percentage | numeric | e.g., 18.00 |
| is_active | boolean | Default: true |
| created_at | timestamptz | Default: now() |
| updated_at | timestamptz | Default: now() |

RLS: Admin-only management, authenticated read.

**New table: `derived_rate_plan_mappings`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Default: gen_random_uuid() |
| base_rate_plan_id | uuid | FK to rate_plans.id |
| channel_markup_id | uuid | FK to channel_markup_settings.id |
| channex_base_rate_plan_id | text | The Channex UUID of the base plan |
| channex_derived_rate_plan_id | text | The Channex UUID of the derived plan |
| channel_name | text | Denormalized for convenience |
| markup_percentage | numeric | Snapshot of markup at creation |
| created_at | timestamptz | Default: now() |
| updated_at | timestamptz | Default: now() |

RLS: Admin-only management, authenticated read.

---

### Phase 2: Edge Function -- `channex-create-derived-rate-plan`

New edge function that:
1. Accepts `{ base_rate_plan_id, channel_markup_id }` 
2. Looks up the base rate plan's Channex ID from `channex_mappings`
3. Looks up the markup percentage from `channel_markup_settings`
4. Looks up the room type and property Channex IDs
5. Calls Channex API `POST /api/v1/rate_plans` with:

```json
{
  "rate_plan": {
    "title": "Standard Rate - Deluxe Suite - Booking.com",
    "property_id": "<channex_property_id>",
    "room_type_id": "<channex_room_type_id>",
    "parent_rate_plan_id": "<channex_base_rate_plan_id>",
    "currency": "USD",
    "sell_mode": "per_room",
    "rate_mode": "derived",
    "options": [{
      "occupancy": 2,
      "is_primary": true,
      "derived_option": {
        "rate": [["increase_by_percent", "18.00"]]
      },
      "rate": 0
    }],
    "inherit_rate": true,
    "inherit_closed_to_arrival": true,
    "inherit_closed_to_departure": true,
    "inherit_stop_sell": true,
    "inherit_min_stay_arrival": true,
    "inherit_min_stay_through": true,
    "inherit_max_stay": true
  }
}
```

6. Saves the result to both `channex_mappings` (entity_type: `derived_rate_plan`) and `derived_rate_plan_mappings`

---

### Phase 3: Edge Function -- `channex-delete-derived-rate-plan`

Accepts `{ derived_mapping_id }`, calls Channex `DELETE /api/v1/rate_plans/:id`, and cleans up both `channex_mappings` and `derived_rate_plan_mappings`.

---

### Phase 4: Admin UI -- Channel Markup Page

**New file: `src/pages/pms/ChannelMarkup.tsx`**

Accessible from the PMS section in the slide menu (new menu item: "Channel Markup" with a Tag icon).

Contains:
1. **Markup Settings Card** -- List of channels with editable markup percentage, save button
2. **Live Preview Calculator** -- Input a base rate, see: "Base: $100 -> Sell to Booking.com: $118 -> After ~15% commission: ~$100.30 net"
3. **Derived Rate Plans Table** -- Shows all derived rate plans grouped by channel, with columns: Base Plan Name, Room Type, Markup %, Channex Status
4. **Action Buttons**:
   - "Create Derived Plans" -- For a given channel, creates derived rate plans for ALL synced base rate plans
   - "Delete Derived Plans" -- Removes all derived plans for a channel
   - "Update Markup" -- When markup changes, deletes old derived plans and recreates with new percentage

**Route**: `/pms/channel-markup`

---

### Phase 5: Automatic Lifecycle Management

**When a new base rate plan is synced to Channex** (in `channex-sync-property` or `channex-create-rate-plan`):
- After creating the base rate plan, check `channel_markup_settings` for active channels
- For each active channel, automatically create a derived rate plan

**When a base rate plan is deleted** (in `src/pages/pms/Prices.tsx` `confirmDelete`):
- Before deleting the base plan, look up any derived mappings and delete those from Channex first
- Then delete the base plan

**When base rates are updated**:
- No action needed -- Channex automatically recalculates derived rates when `inherit_rate: true` is set. The existing rate push triggers continue to work.

---

### Phase 6: Display Enhancements

**Prices page (`src/pages/pms/Prices.tsx`)**:
- Below each rate plan's price line, add a secondary line showing sell rates per channel
- Example: "Base: $100 wkday / $110 wknd -> Booking.com: $118 / $130 (+18%)"

**Room Rates page (`src/pages/front-desk/RoomRates.tsx`)**:
- Add a read-only "Sell Rate" column showing the marked-up rate for each active channel

**PropertySync page (`src/components/channex/PropertySync.tsx`)**:
- Add a "Derived Rate Plans" section to the synced entities table, showing which derived plans are mapped and their parent

---

### Phase 7: Slide Menu + Routing

- Add "Channel Markup" item under the PMS section in `SlideMenu.tsx`
- Add route `/pms/channel-markup` in `App.tsx` wrapped in `AdminRoute`

---

### Files Changed Summary

| File | Change |
|------|--------|
| **New** `src/pages/pms/ChannelMarkup.tsx` | Full channel markup management page |
| **New** `supabase/functions/channex-create-derived-rate-plan/index.ts` | Create derived rate plan in Channex |
| **New** `supabase/functions/channex-delete-derived-rate-plan/index.ts` | Delete derived rate plan from Channex |
| `supabase/config.toml` | Add function entries |
| `src/App.tsx` | Add route |
| `src/components/SlideMenu.tsx` | Add menu item |
| `src/pages/pms/Prices.tsx` | Show sell rates alongside base rates |
| `src/pages/front-desk/RoomRates.tsx` | Show sell rate column |
| `src/components/channex/PropertySync.tsx` | Show derived rate plan mappings |
| `supabase/functions/channex-create-rate-plan/index.ts` | After creating base plan, auto-create derived plans |
| Migration SQL | Create 2 new tables with RLS |

