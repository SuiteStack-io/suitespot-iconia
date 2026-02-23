

## Add "FRONT DESK" Sidebar Section with Read-Only Room Rates Page

### Overview

Create a new sidebar section visible to all user roles, containing a read-only Room Rates page that displays room type information in a card-based layout. The page reads directly from the existing `units`, `rate_plans`, and `rate_plan_prices` tables -- no data duplication.

### Data Available Per Room Type

From the existing database:
- **Room type names**: Deluxe Suite, Double Room with Terrace, Family Suite, Junior Suite, Suite with Terrace
- **Prices**: weekday and weekend rates from `rate_plan_prices` (e.g., Junior Suite: $100/$115)
- **Max occupancy**: from `units.max_guests` (e.g., 3-5 guests)
- **Room area**: from `units.unit_size` (e.g., "52", "75 m2", "55m2+25m2")
- **Photos**: Currently empty arrays in `units.photos` -- the page will handle this gracefully with placeholder images
- **Amenities/features**: Currently empty arrays in `units.features` -- cards will show "No amenities listed" when empty
- **Property amenities table**: Also empty for ICONIA units, so the page will fall back to the `features` array on `units`

### Changes

**1. Sidebar -- `src/components/SlideMenu.tsx`**

Add a new "FRONT DESK" section between ICONIA and PMS with one item:
- "Room Rates" linking to `/front-desk/room-rates`, using the `Tag` icon (to differentiate from the DollarSign icon used in ICONIA's Room Rates)
- No `showFor` restriction -- visible to all roles

**2. New Page -- `src/pages/front-desk/RoomRates.tsx`**

A read-only page at `/front-desk/room-rates` that:
- Fetches `units` grouped by `booking_com_name` to get room type names, area, max_guests, photos, features
- Fetches `rate_plans` + `rate_plan_prices` (active, type-level only) for current pricing
- Displays a responsive card grid (3 columns on desktop, 1 on mobile)

Each card shows:
- Room type name as the card title
- Photo gallery/thumbnails (or a placeholder if no photos exist)
- Area in sqm
- Weekday and weekend rates from the default/standard rate plan
- Max occupancy with a users icon
- Amenities list (from `units.features`)

Header: "Room Rates" with subtitle "Current rates and room information -- updated automatically"

No edit buttons, forms, or save actions.

**3. Route -- `src/App.tsx`**

Add route: `/front-desk/room-rates` wrapped in `ProtectedRoute` (any authenticated user can access)

### Technical Details

| File | Action |
|------|--------|
| `src/components/SlideMenu.tsx` | Add FRONT DESK section with Room Rates item between ICONIA and PMS |
| `src/pages/front-desk/RoomRates.tsx` | New read-only page with card grid layout |
| `src/App.tsx` | Add route for `/front-desk/room-rates` inside `ProtectedRoute` |

No database changes needed -- reads existing tables with existing RLS policies (all authenticated users can already SELECT from `units`, `rate_plans`, and `rate_plan_prices`).

