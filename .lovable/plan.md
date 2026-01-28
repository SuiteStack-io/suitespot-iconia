

## Plan: Fix Remaining Net Revenue Calculation Inconsistencies

### Analysis

The "Monthly RevPAR Breakdown" modal shown in the screenshot is rendered by the AvailabilityCalendar component, which **has already been correctly updated** to calculate net revenue dynamically (lines 625 and 671).

However, I found **two remaining components** that still read the incorrect `net_revenue` database field instead of calculating it:

---

### Files Requiring Updates

| File | Line | Current Code | Issue |
|------|------|--------------|-------|
| `src/components/Dashboard.tsx` | 247 | `r.net_revenue` | Reads from database |
| `src/components/RevenueByRoom.tsx` | 180, 201 | `r.net_revenue` | Reads from database |

---

### Technical Changes

#### 1. File: `src/components/Dashboard.tsx`

**Line 247 - Change from:**
```tsx
const netRevenue = revenueData?.reduce((sum, r) => sum + (r.net_revenue || 0), 0) || 0;
```

**To:**
```tsx
const netRevenue = revenueData?.reduce((sum, r) => sum + ((r.total_price || 0) - (r.commission_amount || 0)), 0) || 0;
```

---

#### 2. File: `src/components/RevenueByRoom.tsx`

**Line 180 - Update query to include commission_amount:**
```tsx
// FROM:
.select('unit_id, total_price, net_revenue, check_in_date, check_out_date, nights')

// TO:
.select('unit_id, total_price, commission_amount, check_in_date, check_out_date, nights')
```

**Lines 200-203 - Change calculation:**
```tsx
// FROM:
const totalRevenue = unitReservations.reduce(
  (sum, r) => sum + (r.net_revenue || r.total_price || 0),
  0
);

// TO:
const totalRevenue = unitReservations.reduce(
  (sum, r) => sum + ((r.total_price || 0) - (r.commission_amount || 0)),
  0
);
```

---

### Summary

| Component | Usage | Status |
|-----------|-------|--------|
| ReservationDetail.tsx | Single reservation display | Already fixed |
| Analytics.tsx | Dashboard stats, source breakdown | Already fixed |
| RevenueBySource.tsx | Revenue by source table/exports | Already fixed |
| AvailabilityCalendar.tsx | Monthly RevPAR breakdown modal | Already fixed |
| **Dashboard.tsx** | Main dashboard stats | **Needs fix** |
| **RevenueByRoom.tsx** | Revenue by room report | **Needs fix** |

---

### Expected Result

After these changes, **all net revenue displays** across the application will use the correct formula:

**Net Revenue = Total Price − Commission Amount**

This ensures accurate revenue reporting for all Booking.com reservations (past and future), consistent with the business rule that net revenue must always be calculated dynamically.

