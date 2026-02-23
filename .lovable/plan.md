

## Auto-Fill Price from Rate Plan System

### Current Behavior

The form already auto-fills price and enforces a minimum floor from `units.price_per_night`. However, this is outdated -- the rate plan system (`rate_plans` + `rate_plan_prices` tables) is the single source of truth for pricing, as used by the Admin Room Rates page and Channex integration.

### What Changes

**File: `src/components/CreateReservationDialog.tsx`**

1. **Fetch rate plan prices on mount** -- add a new query to load active rate plans with their prices (same pattern used in `src/pages/front-desk/RoomRates.tsx`). Build a lookup map: `booking_com_name -> weekday_rate`.

2. **Update `updateRoomSelection`** (line 626) -- when a room is selected, look up its `booking_com_name` from the unit, then find the matching weekday rate from the rate plan lookup. Auto-fill the price field with that rate instead of `unit.price_per_night`.

3. **Update `getMinPriceForRoom`** (line 647) -- use the rate plan weekday rate as the floor price instead of `unit.price_per_night`. Falls back to `unit.price_per_night` if no rate plan price exists.

4. **Update helper text** (line 1425-1428) -- change "Min: $XX.XX" to "Standard rate: $XX.XX/night" for all users (not just non-admins). This gives everyone visibility into the base rate.

5. **Update validation error message** (line 1430-1433) -- change to "Rate cannot be lower than the standard rate of $XX.XX/night" per the request.

### Admin Override

Per existing business rules, admin users bypass minimum price validation entirely. The standard rate helper text will still display for admins (informational only), but no validation error will appear and they can enter any price from $0.

### No Database Changes

All data already exists in `rate_plans` and `rate_plan_prices` tables with appropriate RLS policies allowing authenticated users to SELECT.

### Technical Details

**Rate plan lookup logic:**
- Fetch all active rate plans ordered by priority (descending)
- For each room type (`booking_com_name`), find the type-level price (where `unit_id` is null)
- Prefer the default rate plan; otherwise use the highest-priority match
- Store as a `Map<string, number>` mapping room type name to weekday rate

**Modified functions:**
- `updateRoomSelection`: look up rate by `unit.booking_com_name` from the rate plan map
- `getMinPriceForRoom`: same lookup, falling back to `unit.price_per_night`
- `Unit` interface (line 161): add `booking_com_name: string | null` and update the `fetchUnits` query to include it

