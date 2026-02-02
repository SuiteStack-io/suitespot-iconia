
## PMS Prices Page - Rate Plan Management System

### Overview

Create a comprehensive rate plan management system in the PMS Prices page that becomes the single source of truth for all pricing across the application. This will replace the scattered pricing inputs currently found in the Rooms page and prevent manual price overrides elsewhere.

---

### Visual Summary

```text
+------------------------------------------------------------------+
|  PMS > Prices                                            [+ New] |
+------------------------------------------------------------------+
|                                                                  |
|  +------------------------------------------------------------+  |
|  |  RATE PLANS                                                |  |
|  +------------------------------------------------------------+  |
|  |                                                            |  |
|  |  +-------------------------------------------------------+ |  |
|  |  | Standard Rate Plan                         [Default]  | |  |
|  |  | Valid: Always                              [Edit] [x] | |  |
|  |  +-------------------------------------------------------+ |  |
|  |  | Room Type           | Weekday | Weekend | Min Stay    | |  |
|  |  |---------------------|---------|---------|-------------| |  |
|  |  | 1-Bedroom Studio    |   $120  |   $135  |     1       | |  |
|  |  | 1-Bedroom Nile View |   $150  |   $165  |     1       | |  |
|  |  | 2-Bedroom Suite     |   $200  |   $220  |     2       | |  |
|  |  | Penthouse           |   $350  |   $385  |     3       | |  |
|  |  +-------------------------------------------------------+ |  |
|  |                                                            |  |
|  |  +-------------------------------------------------------+ |  |
|  |  | Summer Season 2026                                    | |  |
|  |  | Valid: Jun 1 - Aug 31, 2026                [Edit] [x] | |  |
|  |  +-------------------------------------------------------+ |  |
|  |  | Room Type           | Weekday | Weekend | Min Stay    | |  |
|  |  |---------------------|---------|---------|-------------| |  |
|  |  | 1-Bedroom Studio    |   $140  |   $155  |     2       | |  |
|  |  | 1-Bedroom Nile View |   $180  |   $200  |     2       | |  |
|  |  | 2-Bedroom Suite     |   $250  |   $275  |     3       | |  |
|  |  | Penthouse           |   $450  |   $495  |     5       | |  |
|  |  +-------------------------------------------------------+ |  |
|  |                                                            |  |
|  +------------------------------------------------------------+  |
|                                                                  |
+------------------------------------------------------------------+
```

```text
CREATE/EDIT RATE PLAN DIALOG
+----------------------------------------------------------+
|  Create Rate Plan                                    [x] |
+----------------------------------------------------------+
|                                                          |
|  Plan Name: [Summer Season 2026              ]           |
|                                                          |
|  +-- Validity Period ----------------------------------+ |
|  |  ( ) Always active (default rate)                   | |
|  |  (o) Date range:                                    | |
|  |      From: [Jun 1, 2026]  To: [Aug 31, 2026]       | |
|  +-----------------------------------------------------+ |
|                                                          |
|  +-- Room Type Rates ---------------------------------+  |
|  | Room Type           | Weekday ($) | Weekend ($)   |  |
|  |---------------------|-------------|---------------|  |
|  | 1-Bedroom Studio    | [140      ] | [155        ] |  |
|  | 1-Bedroom Nile View | [180      ] | [200        ] |  |
|  | 2-Bedroom Suite     | [250      ] | [275        ] |  |
|  | Penthouse           | [450      ] | [495        ] |  |
|  +----------------------------------------------------+  |
|                                                          |
|  [ ] Auto-calculate weekend rate (+10%, round to $5)     |
|                                                          |
|                          [Cancel]  [Save Rate Plan]      |
+----------------------------------------------------------+
```

---

### Database Changes

#### New Table: `rate_plans`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Rate plan name (e.g., "Standard", "Summer 2026") |
| is_default | boolean | Whether this is the fallback rate plan |
| valid_from | date | Start date (null for always valid) |
| valid_to | date | End date (null for always valid) |
| is_active | boolean | Enable/disable the plan |
| priority | integer | Higher priority plans override lower ones |
| created_at | timestamp | Creation timestamp |
| updated_at | timestamp | Last update timestamp |

#### New Table: `rate_plan_prices`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| rate_plan_id | uuid | Foreign key to rate_plans |
| room_type | text | Room type (maps to booking_com_name) |
| weekday_rate | numeric | Price for Sun-Wed nights |
| weekend_rate | numeric | Price for Thu-Sat nights |
| min_stay | integer | Minimum stay requirement |
| created_at | timestamp | Creation timestamp |

---

### Technical Implementation

#### 1. Create Rate Plans Management Page

**File: `src/pages/pms/Prices.tsx`**

- Display all rate plans in expandable cards
- Show room type pricing table within each plan
- Add/Edit/Delete rate plans with dialog forms
- Toggle active/inactive status
- Set default rate plan
- Drag-and-drop priority ordering

#### 2. Create Rate Plan Components

**New Files:**
- `src/components/pms/RatePlanCard.tsx` - Expandable card displaying a rate plan
- `src/components/pms/RatePlanDialog.tsx` - Create/Edit rate plan dialog
- `src/components/pms/RatePlanPricesTable.tsx` - Table of room type prices

#### 3. Update Pricing Lookups

**Files to modify:**

| File | Change |
|------|--------|
| `src/pages/BookingFlow.tsx` | Fetch active rate plan prices instead of unit.price_per_night |
| `src/components/CreateReservationDialog.tsx` | Use rate plan pricing, add read-only price display |
| `src/pages/ReservationDetail.tsx` | Remove price editing or restrict to admin with warning |
| `src/pages/Rooms.tsx` | Remove price_per_night and weekend_rate columns from editing |
| `src/pages/RoomRates.tsx` | Redirect to /pms/prices or show rate plan prices |

#### 4. Rate Resolution Logic

Create a utility function to resolve the correct rate:

```typescript
// src/lib/rateResolver.ts
export const getActiveRate = async (
  roomType: string, 
  checkInDate: Date
): Promise<{ weekdayRate: number; weekendRate: number; minStay: number }> => {
  // 1. Find all active rate plans valid for the check-in date
  // 2. Sort by priority (highest first)
  // 3. Return the first matching rate plan's prices for the room type
  // 4. Fall back to default rate plan if no date-specific plan matches
}
```

---

### Enforcement: Preventing Price Overrides

1. **CreateReservationDialog**: Price field becomes read-only, auto-populated from rate plan
2. **ReservationDetail**: Price editing hidden for non-admins; admins see warning when overriding
3. **Rooms Page**: Remove price columns entirely - prices managed only in PMS > Prices
4. **BookingFlow**: Prices calculated automatically from rate plans

---

### File Summary

| File | Action | Description |
|------|--------|-------------|
| Database migration | Create | Add `rate_plans` and `rate_plan_prices` tables with RLS |
| `src/pages/pms/Prices.tsx` | Modify | Full rate plan management interface |
| `src/components/pms/RatePlanCard.tsx` | Create | Rate plan display card component |
| `src/components/pms/RatePlanDialog.tsx` | Create | Create/edit rate plan dialog |
| `src/components/pms/RatePlanPricesTable.tsx` | Create | Room type prices table |
| `src/lib/rateResolver.ts` | Create | Utility to resolve active rates for a date |
| `src/pages/BookingFlow.tsx` | Modify | Use rate resolver for pricing |
| `src/components/CreateReservationDialog.tsx` | Modify | Read-only prices from rate plans |
| `src/pages/ReservationDetail.tsx` | Modify | Restrict price editing, add warnings |
| `src/pages/Rooms.tsx` | Modify | Remove price editing columns |
| `src/pages/RoomRates.tsx` | Modify | Redirect to PMS Prices or display rate plan data |

---

### Migration Strategy

1. **Phase 1**: Create tables and import existing prices as "Standard" rate plan
2. **Phase 2**: Build PMS Prices UI for managing rate plans
3. **Phase 3**: Update booking flows to use rate plans
4. **Phase 4**: Remove/disable price editing in other locations

---

### Benefits

- **Single source of truth**: All pricing managed in one location
- **Seasonal pricing**: Easily create date-range specific rates
- **Audit trail**: Track when prices were changed
- **Consistency**: No more conflicting prices across different screens
- **Flexibility**: Support for future promotions, special event pricing
