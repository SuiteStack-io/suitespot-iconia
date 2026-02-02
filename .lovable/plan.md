

## PMS Restrictions Page - Rate Plan Configuration System

### Overview

Transform the Restrictions page into a comprehensive rate plan configuration interface. This page displays all existing rate plans (from PMS > Prices) and allows configuring additional booking rules, policies, and restrictions for each one. The design follows the reference image with an inline editing layout using rows with labels, values, and Edit buttons.

---

### Visual Design (Based on Reference Image)

```text
+------------------------------------------------------------------+
|  PMS > Restrictions                                              |
+------------------------------------------------------------------+
|                                                                  |
|  Select Rate Plan: [ Standard Rate                          v ] |
|                                                                  |
+------------------------------------------------------------------+
|  RATE PLAN CONFIGURATION                                        |
+------------------------------------------------------------------+
|                                                                  |
|  +------------------------------------------------------------+ |
|  |                                                            | |
|  |  Rate plan name    Standard Rate                    [Edit] | |
|  |  --------------------------------------------------------- | |
|  |  Policy            Flexible - 1 day                 [Edit] | |
|  |  --------------------------------------------------------- | |
|  |  Meals             No meals                         [Edit] | |
|  |  --------------------------------------------------------- | |
|  |  Value adds        No value adds                    [Edit] | |
|  |  --------------------------------------------------------- | |
|  |  Minimum stay      2 night minimum stay             [Edit] | |
|  |  --------------------------------------------------------- | |
|  |  Bookable          2 days or more before check-in   [Edit] | |
|  |  --------------------------------------------------------- | |
|  |  Price             Managed by PMS > Prices          [View] | |
|  |  --------------------------------------------------------- | |
|  |  Rooms             Deluxe Suite, Junior Suite, ...  [Edit] | |
|  |                                                            | |
|  +------------------------------------------------------------+ |
|                                                                  |
|              [Go back]  [Apply changes]                          |
|                                                                  |
+------------------------------------------------------------------+
```

---

### Database Changes

#### Extend `rate_plans` Table

Add new columns to the existing `rate_plans` table:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| cancellation_policy | text | 'flexible_1_day' | Options: 'flexible_1_day', 'non_refundable' |
| meal_plan | text | 'no_meals' | Options: 'no_meals', 'breakfast', 'half_board', 'full_board' |
| meal_plan_price | numeric | null | Price per person per night if meals included |
| advance_booking_days | integer | 0 | Minimum days before check-in required to book |
| applicable_room_types | text[] | null | Array of room type names this plan applies to (null = all) |

#### New Table: `rate_plan_value_adds`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| rate_plan_id | uuid | Foreign key to rate_plans |
| name | text | Value add name (e.g., "Parking", "Massage") |
| description | text | Optional description |
| price | numeric | Price for this value add |
| is_per_night | boolean | If true, charged per night; otherwise one-time |
| created_at | timestamp | Creation timestamp |

---

### Technical Implementation

#### 1. Update Restrictions Page

**File: `src/pages/pms/Restrictions.tsx`**

Transform the placeholder into a full configuration page:
- Dropdown to select a rate plan
- Display all settings in the row-based layout from the reference image
- Each row shows: Label (bold) | Current Value | Edit button
- Inline edit dialogs for each setting

#### 2. Create Restriction Components

**New Files:**

| File | Description |
|------|-------------|
| `src/components/pms/RestrictionRow.tsx` | Reusable row component with label, value, Edit button |
| `src/components/pms/CancellationPolicyDialog.tsx` | Dialog to edit cancellation policy |
| `src/components/pms/MealPlanDialog.tsx` | Dialog to edit meal plan settings |
| `src/components/pms/ValueAddsDialog.tsx` | Dialog to manage value adds |
| `src/components/pms/BookingRulesDialog.tsx` | Dialog for advance booking window |
| `src/components/pms/RoomApplicabilityDialog.tsx` | Dialog to select applicable room types |

#### 3. UI Component Details

**RestrictionRow Component:**
```typescript
interface RestrictionRowProps {
  label: string;
  value: string;
  onEdit?: () => void;
  editLabel?: string; // "Edit" or "View"
  disabled?: boolean;
}
```

**Cancellation Policy Options:**
- Flexible - 1 day before check-in
- Non-refundable

**Meal Plan Options:**
- No meals
- Breakfast included
- Half board (breakfast + dinner)
- Full board (all meals)

**Value Adds Examples:**
- Parking
- Massage
- Night credits
- Airport transfer
- Late checkout

---

### Page Flow

1. **Select Rate Plan**: Dropdown populated from existing rate plans
2. **View/Edit Settings**: Each restriction displayed in a row
3. **Inline Editing**: Click Edit opens a dialog for that specific setting
4. **Save Changes**: Apply changes button saves all modifications

---

### File Summary

| File | Action | Description |
|------|--------|-------------|
| Database migration | Create | Add columns to rate_plans + create rate_plan_value_adds table |
| `src/pages/pms/Restrictions.tsx` | Modify | Full restriction configuration interface |
| `src/components/pms/RestrictionRow.tsx` | Create | Reusable row component matching reference design |
| `src/components/pms/CancellationPolicyDialog.tsx` | Create | Cancellation policy selector |
| `src/components/pms/MealPlanDialog.tsx` | Create | Meal plan configuration dialog |
| `src/components/pms/ValueAddsDialog.tsx` | Create | Value adds management dialog |
| `src/components/pms/BookingRulesDialog.tsx` | Create | Advance booking window dialog |
| `src/components/pms/RoomApplicabilityDialog.tsx` | Create | Room type selection with Booking.com names |

---

### Integration Points

1. **Rate Plans**: Restrictions page reads rate plans created in PMS > Prices
2. **Room Types**: Uses `booking_com_name` from units table for room selection
3. **Pricing**: Price row links to PMS > Prices (view only, managed there)
4. **Booking Flow**: Future integration will enforce restrictions during reservation creation

---

### RLS Policies

- **View**: Authenticated users can view restrictions
- **Modify**: Only admin/manager roles can edit restrictions

