
## Multi-Room Guest Counts and Simplified Guest Details

### Overview

Add per-room Adults/Children dropdowns to each room card, auto-adjust pricing for extra guests using existing database fields, remove the separate "Number of Guests" section, and simplify guest names to main guest only.

### Data Sources (no database changes needed)

- `rate_plans.extra_adult_rate`: currently $50 for all room types
- `units.default_occupancy`: currently 2 for all room types
- `units.max_guests`: 3-5 depending on room type

### Changes -- File: `src/components/CreateReservationDialog.tsx`

**1. New per-room state arrays**

Replace single `adults`/`children` state variables with per-room arrays:
- `roomAdults: number[]` -- defaults to `[1]`, synced with `numberOfRooms`
- `roomChildren: number[]` -- defaults to `[0]`, synced with `numberOfRooms`

Update the `useEffect` that syncs with `numberOfRooms` (line 248) to also sync these arrays.

**2. Extend data fetching**

- Add `default_occupancy` and `max_guests` to the `Unit` interface and `fetchUnits` query (line 521)
- Extend `fetchRatePlanPrices` to also build an `extraAdultRateMap: Map<string, number>` (room type to extra adult rate)

**3. Update room card layout (lines 1381-1476)**

Change each room card from a 2-column grid to a 2x2 grid with 4 fields:
- Row 1: Room Name | Price/Night (existing)
- Row 2: Adults dropdown (1 to max_guests, default 1) | Children dropdown (0 to 3, default 0)

**4. Auto-adjust price for extra guests**

When adults count changes for a room:
- Extra adults = `roomAdults[i] - unit.default_occupancy` (minimum 0)
- Extra charge = extra adults x extra_adult_rate from rate plan
- Auto-fill price = base rate + extra charge
- Show helper: "Includes $XX/night extra guest fee (N additional adult(s))" when extra charge applies
- Floor price becomes base rate + extra charge (not just base rate)

Update `getMinPriceForRoom` and `updateRoomSelection` accordingly. Create a new `updateRoomAdults` handler that recalculates price.

**5. Remove "Number of Guests" section (lines 1543-1592)**

Delete the entire section. Total guests computed by summing `roomAdults` and `roomChildren` across all rooms.

**6. Simplify Guest Names to Main Guest Only (lines 1594-1671)**

- Change label to "Main Guest Details"
- Always show exactly 1 guest form (first name, last name, guest type, gender)
- Add note: "Additional guests will provide their details at check-in"
- Remove the `useEffect` that syncs guest arrays with adults/children (lines 354-382)

**7. Update form submission (line 1025)**

- Compute `totalAdults`/`totalChildren` by summing across rooms
- Each reservation gets its room-specific adults/children counts
- `number_of_guests` = that room's adults + children
- Guest names always contains just the main guest

**8. Update validation (line 887)**

- Remove validation for guest types array (only 1 guest)
- Remove gender validation for "all adult guests" (only main guest)
- Keep main guest first/last name and gender validation

**9. Update form reset (lines 1159-1187)**

Reset `roomAdults` and `roomChildren` arrays to `[1]` and `[0]`.

**10. Marriage certificate logic**

With only 1 guest form, auto-detection of male+female pair is no longer possible. Disable the auto-detection -- marriage certificate can be requested at check-in instead.

### Technical Details

| Area | Current | New |
|------|---------|-----|
| Adults/Children state | Single `adults`, `children` numbers | Per-room arrays `roomAdults[]`, `roomChildren[]` |
| Guest forms | N forms (1 per guest) | Always 1 form (main guest only) |
| Extra guest pricing | Not implemented | Auto-calculated from `rate_plans.extra_adult_rate` |
| Floor price | Base rate only | Base rate + extra guest fee |
| Number of Guests section | Separate section below rooms | Removed (computed from room cards) |
| Unit interface | Missing `default_occupancy`, `max_guests` | Added both fields |
