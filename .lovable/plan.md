
## Update Room Rates Page for Channex Rate Plan Mapping

### Overview

This plan restructures the Room Rates page from a simple read-only view to a comprehensive Channex-compatible rate plan management interface. The page will capture all fields required for Channex rate plan sync while maintaining the current design aesthetic.

---

### Database Changes Required

New columns need to be added to the `rate_plans` table to support Channex mapping:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `property_id` | uuid | null | Reference to the property in channex_mappings |
| `currency` | text | 'USD' | Fixed currency for Channex |
| `sell_mode` | text | 'per_room' | Either 'per_room' or 'per_person' |
| `extra_adult_rate` | numeric | 50 | Fixed default for extra adults |
| `extra_child_rate` | numeric | 0 | Fixed default for extra children |

The `rate_plan_prices` table also needs new columns for occupancy options:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `base_occupancy` | integer | 2 | Base occupancy for the room type |
| `max_occupancy` | integer | null | Max occupancy (pulls from units.max_guests) |

---

### SQL Migration

```sql
-- Add Channex rate plan fields
ALTER TABLE rate_plans 
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES channex_mappings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS sell_mode text DEFAULT 'per_room',
  ADD COLUMN IF NOT EXISTS extra_adult_rate numeric DEFAULT 50,
  ADD COLUMN IF NOT EXISTS extra_child_rate numeric DEFAULT 0;

-- Add check constraint for sell_mode
ALTER TABLE rate_plans 
  ADD CONSTRAINT rate_plans_sell_mode_check 
  CHECK (sell_mode IN ('per_room', 'per_person'));

-- Add occupancy columns to rate_plan_prices
ALTER TABLE rate_plan_prices 
  ADD COLUMN IF NOT EXISTS base_occupancy integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS max_occupancy integer;
```

---

### Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/pages/RoomRates.tsx` | Major rewrite | Transform to editable Channex-compatible view |
| `src/components/pms/RatePlanDialog.tsx` | Modify | Add new Channex fields to dialog |
| `src/components/pms/RatePlanCard.tsx` | Modify | Display new fields (sell mode, property) |

---

### New Room Rates Page Layout

The restructured page will include:

**Header Section**
```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Room Rates                                                    [Save Changes]   │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Rate Plan: [Standard Rate Plan      ▼]                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Title:        [__________________] (editable)                                   │
│ Property ID:  abc123-def456...     (read-only, from Channex mapping)            │
│ Currency:     USD                   (fixed, read-only)                          │
│ Sell Mode:    [Per Room ▼]          (dropdown: Per Room / Per Person)           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Rates Table**
```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Room Type     │ Weekday │ Weekend │ Min Stay │ Base Occ │ Max Occ │ Extra Adult │ Extra Child │
├───────────────┼─────────┼─────────┼──────────┼──────────┼─────────┼─────────────┼─────────────┤
│ Deluxe Suite  │  $150   │  $165   │    1     │    2     │    4    │    $50      │     $0      │
│ Standard Room │  $100   │  $110   │    1     │    2     │    2    │    $50      │     $0      │
│ Family Room   │  $200   │  $220   │    2     │    4     │    6    │    $50      │     $0      │
└───────────────┴─────────┴─────────┴──────────┴──────────┴─────────┴─────────────┴─────────────┘
```

---

### Implementation Details

#### 1. Page State Management

The page will manage:
- Selected rate plan (dropdown to switch between plans)
- Editable title field
- Read-only property_id display (from channex_mappings)
- Currency display (fixed USD)
- Sell mode toggle/dropdown
- Editable rates table with occupancy fields

#### 2. Data Flow

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  rate_plans     │────>│  rate_plan_prices│────>│  units          │
│  (title, mode)  │     │  (rates, occ)    │     │  (max_guests)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                        │
         │    ┌──────────────────────────────┐
         └───>│  channex_mappings            │
              │  (property_id for display)   │
              └──────────────────────────────┘
```

#### 3. Channex Schema Mapping

The data will map to Channex's rate plan schema:

| Channex Field | Source |
|---------------|--------|
| `title` | `rate_plans.name` |
| `property_id` | `channex_mappings.channex_id` (via property lookup) |
| `room_type_id` | Derived from room type to Channex mapping |
| `currency` | Fixed `'USD'` |
| `sell_mode` | `rate_plans.sell_mode` |
| `options.base_occupancy` | `rate_plan_prices.base_occupancy` |
| `options.max_occupancy` | `rate_plan_prices.max_occupancy` or `units.max_guests` |
| `options.extra_adult_rate` | `rate_plans.extra_adult_rate` (default 50) |
| `options.extra_child_rate` | `rate_plans.extra_child_rate` (default 0) |

#### 4. UI Components

The page will use existing shadcn components:
- `Select` for rate plan selection and sell mode dropdown
- `Input` for editable title and rate values
- `Table` for the rates display (consistent with current design)
- `Button` with coral/orange accent for save action

#### 5. Validation Rules

| Field | Rule |
|-------|------|
| Title | Required, non-empty |
| Weekday Rate | Numeric >= 0 |
| Weekend Rate | Numeric >= 0 |
| Min Stay | Integer >= 1 |
| Base Occupancy | Integer >= 1 |
| Max Occupancy | Integer >= Base Occupancy |
| Sell Mode | Must be 'per_room' or 'per_person' |

---

### Key Features

1. **Rate Plan Selector**: Dropdown to switch between existing rate plans
2. **Editable Title**: Update rate plan name inline
3. **Property ID Display**: Read-only, fetched from channex_mappings for the current property
4. **Fixed Currency**: USD displayed as read-only
5. **Sell Mode Toggle**: Dropdown with "Per Room" and "Per Person" options
6. **Occupancy Options**: Base and max occupancy per room type
7. **Fixed Extra Rates**: Extra adult ($50) and extra child ($0) shown as read-only defaults

---

### Technical Notes

- The property_id will be pulled from `channex_mappings` where `entity_type = 'property'` for the current ICONIA property context
- Max occupancy can auto-populate from the Room Types page (`units.max_guests`) if not explicitly set
- Extra adult/child rates are fixed at $50/$0 per the requirements but stored in DB for future flexibility
- The page maintains the existing coral/orange accent color scheme

---

### Summary

| Item | Details |
|------|---------|
| Database changes | 5 new columns on rate_plans, 2 on rate_plan_prices |
| Main page | `src/pages/RoomRates.tsx` - major restructure |
| New fields | title, property_id, currency, sell_mode, occupancy options |
| Fixed defaults | currency=USD, extra_adult=50, extra_child=0 |
| UI style | Consistent with current design, same color scheme |
