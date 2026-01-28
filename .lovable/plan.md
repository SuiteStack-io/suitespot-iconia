

## Plan: Calculate Net Revenue Dynamically Across All Revenue Reports

### Problem
The `net_revenue` field stored in the database for Booking.com reservations is incorrect ($360.00 instead of $350.06). Multiple components across the application read this incorrect value, causing revenue reports to be inaccurate.

**Correct Formula:** `Net Revenue = Total Price - Commission Amount`

---

### Files That Need Updates

| File | Usage | Lines |
|------|-------|-------|
| `src/components/RevenueBySource.tsx` | Revenue by Source table, totals, exports | 163, 170 |
| `src/pages/Analytics.tsx` | Dashboard stats, source breakdown dialogs | 233, 370, 546, 558 |
| `src/components/AvailabilityCalendar.tsx` | Calendar occupancy metrics | 624, 670 |

---

### Technical Changes

#### 1. File: `src/components/RevenueBySource.tsx`

**Line 163 - Change aggregation to calculate instead of read:**
```tsx
// FROM:
sourceMap[source].netRevenue += reservation.net_revenue || 0;

// TO:
const calculatedNetRevenue = (reservation.total_price || 0) - (reservation.commission_amount || 0);
sourceMap[source].netRevenue += calculatedNetRevenue;
```

**Line 170 - Change booking details to calculate:**
```tsx
// FROM:
netRevenue: reservation.net_revenue || 0,

// TO:
netRevenue: (reservation.total_price || 0) - (reservation.commission_amount || 0),
```

---

#### 2. File: `src/pages/Analytics.tsx`

**Line 233 - Change main stats calculation:**
```tsx
// FROM:
const netRevenue = revenueData?.reduce((sum, r) => sum + (r.net_revenue || 0), 0) || 0;

// TO:
const netRevenue = revenueData?.reduce((sum, r) => 
  sum + ((r.total_price || 0) - (r.commission_amount || 0)), 0) || 0;
```

**Line 370 - Change direct source details aggregation:**
```tsx
// FROM:
sourceMap[source].netRevenue += reservation.net_revenue || 0;

// TO:
sourceMap[source].netRevenue += (reservation.total_price || 0) - (reservation.commission_amount || 0);
```

**Line 546 - Change direct source map aggregation:**
```tsx
// FROM:
directSourceMap[source].netRevenue += reservation.net_revenue || 0;

// TO:
directSourceMap[source].netRevenue += (reservation.total_price || 0) - (reservation.commission_amount || 0);
```

**Line 558 - Change direct totals calculation:**
```tsx
// FROM:
netRevenue: directData.reduce((sum, r) => sum + (r.net_revenue || 0), 0),

// TO:
netRevenue: directData.reduce((sum, r) => sum + ((r.total_price || 0) - (r.commission_amount || 0)), 0),
```

---

#### 3. File: `src/components/AvailabilityCalendar.tsx`

**Lines 624-627 - Change period revenue calculation:**
```tsx
// FROM:
const netRevenue = reservation.net_revenue || 0;
const proportionalNetRevenue = totalNights > 0 
  ? (netRevenue / totalNights) * nightsInPeriod 
  : 0;

// TO:
const calculatedNetRevenue = (reservation.total_price || 0) - (reservation.commission_amount || 0);
const proportionalNetRevenue = totalNights > 0 
  ? (calculatedNetRevenue / totalNights) * nightsInPeriod 
  : 0;
```

**Lines 670-673 - Change per-unit revenue calculation:**
```tsx
// FROM:
const netRevenue = reservation.net_revenue || 0;
unitRevenue += totalNights > 0 
  ? (netRevenue / totalNights) * nightsInPeriod 
  : 0;

// TO:
const calculatedNetRevenue = (reservation.total_price || 0) - (reservation.commission_amount || 0);
unitRevenue += totalNights > 0 
  ? (calculatedNetRevenue / totalNights) * nightsInPeriod 
  : 0;
```

---

### Summary of Impact

This change will ensure:
- **All past Booking.com reservations** display correct net revenue
- **All future reservations** use the calculated value
- **Revenue by Source report** shows accurate totals
- **Analytics dashboard** displays correct net revenue stats
- **Calendar occupancy metrics** calculate accurate RevPAR
- **Excel/CSV exports** include correct net revenue figures

---

### Expected Result

For the Booking.com reservation in question:
- Total Price: $414.00
- Commission: $63.94  
- **Net Revenue: $350.06** (calculated everywhere, not read from database)

All revenue reports, analytics, and calendar metrics will now show the correct net revenue for all Booking.com reservations, including past bookings.

