

## Add Per-Room Pricing with Expandable Room Type Rows

### Overview

Enhance the Rate Plan Dialog and Prices Table to support per-room pricing. Room types will become clickable rows that expand to show individual rooms underneath, each with their own rate inputs. This allows setting a base rate at the room type level while optionally overriding rates for specific rooms.

---

### Visual Summary

```text
RATE PLAN DIALOG - Room Type Rates Table
+-------------------------------------------------------------------+
| Room Type              | Weekday ($) | Weekend ($) | Min Stay    |
|------------------------|-------------|-------------|-------------|
| v Deluxe Suite (5)     | [150      ] | [165      ] | [1        ] |
|   └ Room 506           | [150      ] | [165      ] | [1        ] |
|   └ Room 509           | [160      ] | [175      ] | [1        ] |
|   └ Room 511           | [150      ] | [165      ] | [1        ] |
|   └ Room 512           | [150      ] | [165      ] | [1        ] |
|   └ Room 518           | [150      ] | [165      ] | [1        ] |
| > Junior Suite (2)     | [120      ] | [135      ] | [1        ] |
| > Suite with Terrace   | [180      ] | [200      ] | [2        ] |
+-------------------------------------------------------------------+

Legend:
  v = Expanded (shows individual rooms)
  > = Collapsed (click to expand)
  Room rows inherit from room type unless manually overridden
```

---

### Database Changes

Add a nullable `unit_id` column to `rate_plan_prices` to support room-level overrides:

| Column | Type | Description |
|--------|------|-------------|
| unit_id | uuid (nullable) | References specific unit for per-room pricing |

- When `unit_id` is NULL: Price applies to entire room type
- When `unit_id` is set: Price applies to that specific room only

---

### Technical Implementation

#### 1. Database Migration

```sql
ALTER TABLE public.rate_plan_prices 
ADD COLUMN unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE;

-- Create index for efficient lookups
CREATE INDEX idx_rate_plan_prices_unit ON public.rate_plan_prices(unit_id);
```

#### 2. Update RatePlanDialog Component

**File: `src/components/pms/RatePlanDialog.tsx`**

Changes:
- Add `units` prop containing all rooms with their room types
- Track expanded state per room type
- Display room type rows that are clickable to expand/collapse
- Show individual room rows underneath when expanded
- Room rows inherit rates from room type by default
- Allow overriding rates for specific rooms
- Track which rooms have overrides vs. inherit from type

New state structure:
```typescript
interface RoomPrice {
  weekday_rate: number;
  weekend_rate: number;
  min_stay: number;
  isOverride: boolean; // true = custom rate, false = inherits from type
}

// State: prices by room type + individual room prices
const [typeRates, setTypeRates] = useState<Record<string, RoomPrice>>();
const [roomRates, setRoomRates] = useState<Record<string, RoomPrice>>(); // keyed by unit_id
const [expandedTypes, setExpandedTypes] = useState<Set<string>>();
```

#### 3. Update RatePlanPricesTable Component

**File: `src/components/pms/RatePlanPricesTable.tsx`**

Changes:
- Accept units data to show room breakdowns
- Make room type rows clickable with expand/collapse icons
- Show room count in parentheses: "Deluxe Suite (5)"
- Display individual room rows with room number when expanded
- Visual indication for rooms with custom rates vs. inherited

#### 4. Update Prices Page

**File: `src/pages/pms/Prices.tsx`**

Changes:
- Fetch units data with `id`, `unit_number`, and `booking_com_name`
- Pass units to dialog and table components
- Update save logic to handle both type-level and room-level prices

#### 5. Update Rate Resolver

**File: `src/lib/rateResolver.ts`**

Changes:
- When resolving rates, first check for unit-specific price
- Fall back to room type price if no unit-specific price exists
- Update function signature to accept optional `unitId`

```typescript
export const getActiveRate = async (
  roomType: string,
  checkInDate: Date,
  unitId?: string // Optional: for per-room lookup
): Promise<RateResult>
```

---

### UI Behavior

1. **Room Type Row**
   - Shows chevron icon (> or v) indicating expand state
   - Displays room count in parentheses
   - Rate inputs set the base rate for all rooms of that type
   - Click anywhere on row (except inputs) to toggle expansion

2. **Individual Room Rows (when expanded)**
   - Indented under parent room type
   - Displays room number (e.g., "Room 506")
   - Input fields show inherited value in muted style by default
   - When user types a different value, it becomes an override
   - Small "reset" button to clear override and inherit from type

3. **Saving**
   - Type-level rates saved with `unit_id = NULL`
   - Room-level overrides saved with specific `unit_id`
   - Rooms without overrides don't create database rows

---

### File Summary

| File | Action | Description |
|------|--------|-------------|
| Database migration | Create | Add `unit_id` column to `rate_plan_prices` |
| `src/components/pms/RatePlanDialog.tsx` | Modify | Add expandable room type rows with per-room inputs |
| `src/components/pms/RatePlanPricesTable.tsx` | Modify | Add expandable display with room breakdowns |
| `src/pages/pms/Prices.tsx` | Modify | Fetch units, pass to components, update save logic |
| `src/lib/rateResolver.ts` | Modify | Add unit-specific rate lookup |

---

### Rate Resolution Priority

When looking up a rate for a specific room:

1. **Unit-specific price** in active rate plan for the date → Use this rate
2. **Room type price** in active rate plan for the date → Use this rate
3. **Default rate plan** room type price → Use this rate

