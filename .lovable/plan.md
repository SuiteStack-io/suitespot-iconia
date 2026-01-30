

## Plan: Fix Analytics Occupancy Rate to Match Calendar Calculation

### Problem Identified

The Analytics page shows **43.4%** occupancy while the Unit Availability Calendar shows **68.4%** for January 2026. This is a 25% difference!

**Root Cause Analysis:**

| Issue | Analytics Page | Calendar |
|-------|---------------|----------|
| **1. Units counted** | ALL units (13 total from `select('id')`) | Only ICONIA units filtered by location (12 units) |
| **2. Occupancy formula** | `r.nights` (full reservation nights) | Proportional nights in period |
| **3. Query approach** | Uses `check_in_date >= start AND check_out_date <= end` | Uses overlap query to catch reservations spanning periods |

The key differences:

1. **Wrong unit count**: Line 299-301 fetches ALL units (`select('id')`) instead of only ICONIA units (12 units shown on calendar). This inflates the denominator.

2. **Using `r.nights` instead of proportional calculation**: Line 313 sums `r.nights` which counts full reservation nights, not just nights within the period. A reservation from Dec 28 to Jan 5 would count ALL nights, not just the 5 January nights.

3. **Query logic mismatch**: The reservation query uses `gte('check_in_date', startDate).lte('check_out_date', endDate)` which only finds reservations that start AND end within the period. It misses:
   - Reservations starting before Jan 1 but extending into January
   - Reservations starting in January but extending past Jan 31

### Solution

Update the Analytics occupancy calculation to match the Calendar's approach exactly:

1. Filter units by ICONIA location and available status
2. Query reservations using overlap logic (catches all relevant bookings)
3. Calculate proportional nights within the period

---

### Technical Changes

#### File: `src/pages/Analytics.tsx`

**1. Update unit query (lines 299-303)**

Filter to ICONIA available units only:

```tsx
// Before
const { data: units } = await supabase
  .from('units')
  .select('id');
  
const totalUnits = units?.length || 1;

// After
const { data: units } = await supabase
  .from('units')
  .select('id')
  .eq('location', 'ICONIA')
  .eq('status', 'available');
  
const totalUnits = units?.length || 1;
```

**2. Update reservation query (lines 305-311)**

Use overlap logic to catch all reservations that touch the period:

```tsx
// Before
const { data: reservations } = await supabase
  .from('reservations')
  .select('check_in_date, check_out_date, nights')
  .neq('status', 'Cancelled')
  .is('cancelled_at', null)
  .gte('check_in_date', startDate)
  .lte('check_out_date', endDate);

// After
const { data: reservations } = await supabase
  .from('reservations')
  .select('check_in_date, check_out_date, nights, unit_id')
  .in('status', ['confirmed', 'checked-in', 'checked-out', 'completed'])
  .is('cancelled_at', null)
  .lte('check_in_date', endDate)
  .gte('check_out_date', startDate);
```

**3. Update blocked nights query (lines 322-332)**

Use the already-fetched ICONIA units:

```tsx
// Before
const { data: unitIds } = await supabase
  .from('units')
  .select('id')
  .eq('location', 'ICONIA');

const { count: totalBlockedNights } = await supabase
  .from('blocked_dates')
  .select('*', { count: 'exact', head: true })
  .in('unit_id', unitIds?.map(u => u.id) || [])
  .gte('blocked_date', startDate)
  .lte('blocked_date', endDate);

// After - use the already-fetched units
const { count: totalBlockedNights } = await supabase
  .from('blocked_dates')
  .select('*', { count: 'exact', head: true })
  .in('unit_id', units?.map(u => u.id) || [])
  .gte('blocked_date', startDate)
  .lte('blocked_date', endDate);
```

**4. Replace total nights calculation (lines 313-314)**

Calculate proportional nights within period (matching calendar logic):

```tsx
// Before
const totalNights = reservations?.reduce((sum, r) => sum + (r.nights || 0), 0) || 0;
setTotalNights(totalNights);

// After - Calculate proportional nights within period
const unitIdSet = new Set(units?.map(u => u.id) || []);
let totalNights = 0;

reservations?.forEach(r => {
  // Only count reservations for ICONIA units
  if (!r.unit_id || !unitIdSet.has(r.unit_id)) return;
  
  const checkIn = new Date(r.check_in_date);
  const checkOut = new Date(r.check_out_date);
  
  // Calculate overlap with current period
  const overlapStart = checkIn > start ? checkIn : start;
  const overlapEnd = checkOut < end ? checkOut : new Date(end.getTime() + 86400000); // add 1 day to end
  
  if (overlapStart < overlapEnd) {
    const nightsInPeriod = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24));
    totalNights += nightsInPeriod;
  }
});

setTotalNights(totalNights);
```

---

### Calculation Comparison

**January 2026 (31 days):**

| Metric | Before (Analytics) | After (Fixed) |
|--------|-------------------|---------------|
| Total Units | 13 (all) | 12 (ICONIA only) |
| Days in Period | 31 | 31 |
| Available Nights | ~400 (13 × 31 - blocked) | ~326 (12 × 31 - blocked) |
| Booked Nights | Lower (missing overlap reservations) | Higher (includes all overlapping reservations) |
| Occupancy | 43.4% | ~68.4% |

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Analytics.tsx` | Fix occupancy calculation to use ICONIA units, overlap query, and proportional nights |

---

### Expected Result

After this fix:
- Analytics page and Calendar will show the same occupancy rate for January 2026 (~68.4%)
- Both components will use identical calculation logic:
  - Same unit filtering (ICONIA, available status)
  - Same reservation overlap detection
  - Same proportional nights calculation
  - Same blocked dates handling

