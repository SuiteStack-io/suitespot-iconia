
## Plan: Fix Analytics Occupancy to Match Calendar Exactly

### Root Cause Identified

The 69.6% vs 68.4% discrepancy is caused by **date comparison differences**:

| Component | `endDate` Type | Time Component | Comparison Result |
|-----------|---------------|----------------|-------------------|
| **Calendar** | `endOfMonth(currentMonth)` | Jan 31 @ 23:59:59.999 | `checkOut < endDate` → **true** for Jan 31 checkouts |
| **Analytics** | `new Date('2026-01-31')` | Jan 31 @ 00:00:00.000 | `checkOut < end` → **false** for Jan 31 checkouts |

**The Problem:**
For a reservation checking out on Jan 31:
- Calendar: `Jan 31 00:00 < Jan 31 23:59` = **true** → uses checkout date directly → correct
- Analytics: `Jan 31 00:00 < Jan 31 00:00` = **false** → uses `addDays(end, 1)` = Feb 1 → **counts extra night!**

This causes Analytics to **overcount nights** for reservations ending on the last day of the period.

---

### Solution

Normalize both `start` and `end` dates in Analytics using `startOfDay()` and use `<=` comparison instead of `<` for checkout dates (matching how the Calendar's `endOfMonth` effectively works).

---

### Technical Changes

#### File: `src/pages/Analytics.tsx`

**1. Update imports (line 20)**

Add `startOfDay` from date-fns:

```tsx
// Before
import { format, startOfMonth, endOfMonth, addMonths, isSameMonth, differenceInDays, addDays } from 'date-fns';

// After
import { format, startOfMonth, endOfMonth, addMonths, isSameMonth, differenceInDays, addDays, startOfDay } from 'date-fns';
```

**2. Update date parsing and comparison (lines 317-334)**

Normalize dates with `startOfDay` and fix the comparison logic:

```tsx
// Before
const start = new Date(startDate);
const end = new Date(endDate);
const days = differenceInDays(end, start) + 1;

// Calculate proportional nights within period (matching calendar logic)
const unitIdSet = new Set(units?.map(u => u.id) || []);
let totalNights = 0;

reservations?.forEach(r => {
  // Only count reservations for ICONIA units
  if (!r.unit_id || !unitIdSet.has(r.unit_id)) return;
  
  const checkIn = new Date(r.check_in_date);
  const checkOut = new Date(r.check_out_date);
  
  // Calculate overlap with current period (using date-fns to match Calendar logic exactly)
  const overlapStart = checkIn > start ? checkIn : start;
  const overlapEnd = checkOut < end ? checkOut : addDays(end, 1);

// After
const start = startOfDay(new Date(startDate));
const end = startOfDay(new Date(endDate));
const days = differenceInDays(end, start) + 1;

// Calculate proportional nights within period (matching calendar logic)
const unitIdSet = new Set(units?.map(u => u.id) || []);
let totalNights = 0;

reservations?.forEach(r => {
  // Only count reservations for ICONIA units
  if (!r.unit_id || !unitIdSet.has(r.unit_id)) return;
  
  const checkIn = startOfDay(new Date(r.check_in_date));
  const checkOut = startOfDay(new Date(r.check_out_date));
  
  // Calculate overlap with current period
  // Use <= for end comparison since checkout on last day should still be within period
  const overlapStart = checkIn > start ? checkIn : start;
  const overlapEnd = checkOut <= end ? checkOut : addDays(end, 1);
```

---

### Why This Fixes It

By normalizing all dates to midnight with `startOfDay()` and using `<=` comparison:

- For a Jan 31 checkout with Jan 31 end date:
  - `checkOut (Jan 31 00:00) <= end (Jan 31 00:00)` = **true**
  - Uses `checkOut` directly (not `addDays(end, 1)`)
  - Correct night count

This matches the Calendar's behavior where `endOfMonth` returns end-of-day timestamp, making all checkout dates on that day satisfy the `< endDate` comparison.

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Analytics.tsx` | Import `startOfDay`, normalize date parsing, fix comparison to use `<=` |

---

### Expected Result

After this fix:
- Analytics will show **68.4%** occupancy for January 2026
- Matches exactly with Calendar's occupancy calculation
- No more overcounting of nights for reservations ending on period boundaries
