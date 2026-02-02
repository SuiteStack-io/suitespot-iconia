

## Add Cancellation Policy Display and Booking.com ID to Rate Plans

### Overview

Enhance the Rate Plan Cards on the Prices page to display the cancellation policy next to the rate plan name, matching the reference image layout. Additionally, add a unique `booking_com_id` field for Booking.com integration.

---

### Visual Design (Based on Reference Image)

```text
+-------------------------------------------------------------------+
| Rate plan name                              | Cancellation policy |
+-------------------------------------------------------------------+
| v Standard 2 days min stay & 24 hrs in      | Flexible - 1 day    |
|   advance                                   |                     |
|   ID 59882860                               |                     |
|   [Flexible]                                |                     |
+-------------------------------------------------------------------+
| > Non-refundable Rate-3 days min stay       | Non-refundable      |
|   ID 59882862                               |                     |
|   [Non-refundable]                          |                     |
+-------------------------------------------------------------------+
```

---

### Database Changes

Add a new column to `rate_plans` table for Booking.com integration:

| Column | Type | Description |
|--------|------|-------------|
| booking_com_id | text | Unique identifier for Booking.com integration (e.g., "59882860") |

---

### Technical Implementation

#### 1. Database Migration

Add nullable `booking_com_id` column to rate_plans:

```sql
ALTER TABLE public.rate_plans 
ADD COLUMN booking_com_id text;

-- Create unique index for Booking.com ID
CREATE UNIQUE INDEX idx_rate_plans_booking_com_id 
ON public.rate_plans(booking_com_id) 
WHERE booking_com_id IS NOT NULL;
```

#### 2. Update RatePlanCard Component

**File: `src/components/pms/RatePlanCard.tsx`**

Changes:
- Add `cancellation_policy` and `booking_com_id` to the RatePlan interface
- Display cancellation policy in a separate column on the right side
- Show Booking.com ID under the rate plan name (e.g., "ID 59882860")
- Add a badge showing the policy type (Flexible/Non-refundable)

New layout for card header:
```text
[Chevron] [Rate Plan Name]              [Cancellation Policy]
          ID [booking_com_id]
          [Policy Badge]
```

#### 3. Update Prices Page Interface

**File: `src/pages/pms/Prices.tsx`**

Changes:
- Update RatePlan interface to include `cancellation_policy` and `booking_com_id`
- Fetch these fields from the database (already fetching `*` so just update interface)

#### 4. Update RatePlanDialog

**File: `src/components/pms/RatePlanDialog.tsx`**

Changes:
- Add input field for Booking.com ID
- Pass `booking_com_id` when saving rate plan

---

### File Summary

| File | Action | Description |
|------|--------|-------------|
| Database migration | Create | Add `booking_com_id` column with unique index |
| `src/components/pms/RatePlanCard.tsx` | Modify | Display cancellation policy, Booking.com ID, and policy badge |
| `src/pages/pms/Prices.tsx` | Modify | Update interface to include new fields |
| `src/components/pms/RatePlanDialog.tsx` | Modify | Add Booking.com ID input field |

---

### UI Details

**Card Header Layout:**
- Left side: Chevron, Rate Plan Name (bold), ID line, Policy Badge
- Right side: Cancellation Policy text, Active toggle, Action buttons

**Policy Badge:**
- "Flexible" badge for `flexible_1_day` policy
- "Non-refundable" badge for `non_refundable` policy

**Cancellation Policy Display:**
- "Flexible - 1 day" for `flexible_1_day`
- "Non-refundable" for `non_refundable`

