
## Plan: Fix Analytics Occupancy Calculation to Match Calendar Exactly

### Problem Identified

Analytics shows **69.6%** occupancy while Calendar shows **68.4%** for January 2026. The 1.2% difference is caused by:

1. **Manual date math with `Math.ceil`** in Analytics (line 337) vs **`differenceInDays`** from date-fns in Calendar (line 621)
2. `Math.ceil` can round up fractional days caused by timezone differences when parsing date strings
3. `differenceInDays` correctly computes whole-day differences without timezone issues

**Example of the problem:**
- When dates are parsed from strings like `'2026-01-01'`, they become midnight in local timezone
- Date arithmetic with `.getTime()` can produce fractional results due to DST or timezone differences
- `Math.ceil` rounds these up, potentially adding extra "nights" to some reservations

---

### Solution

Replace the manual date calculation in Analytics with the same `differenceInDays` and `addDays` functions used by AvailabilityCalendar.

---

### Technical Changes

#### File: `src/pages/Analytics.tsx`

**1. Update imports (line 20)**

Add `differenceInDays` and `addDays` from date-fns:

```tsx
// Before
import { format, startOfMonth, endOfMonth, addMonths, isSameMonth } from 'date-fns';

// After
import { format, startOfMonth, endOfMonth, addMonths, isSameMonth, differenceInDays, addDays } from 'date-fns';
```

**2. Update days calculation (line 319)**

Use `differenceInDays` instead of manual math:

```tsx
// Before
const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

// After
const days = differenceInDays(end, start) + 1;
```

**3. Update overlap calculation (lines 333-337)**

Use `addDays` and `differenceInDays` to match Calendar logic exactly:

```tsx
// Before
const overlapStart = checkIn > start ? checkIn : start;
const overlapEnd = checkOut < end ? checkOut : new Date(end.getTime() + 86400000); // add 1 day to end

if (overlapStart < overlapEnd) {
  const nightsInPeriod = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24));
  totalNights += nightsInPeriod;
}

// After
const overlapStart = checkIn > start ? checkIn : start;
const overlapEnd = checkOut < end ? checkOut : addDays(end, 1);

if (overlapStart < overlapEnd) {
  const nightsInPeriod = differenceInDays(overlapEnd, overlapStart);
  totalNights += nightsInPeriod;
}
```

---

### Why This Fixes It

| Calculation Method | Issue | Result |
|-------------------|-------|--------|
| `Math.ceil` on milliseconds | Rounds up fractional days from timezone differences | **Inflated nights** (69.6%) |
| `differenceInDays` from date-fns | Compares calendar days correctly | **Accurate nights** (68.4%) |

The Calendar at line 621 uses:
```tsx
const nightsInPeriod = differenceInDays(overlapEnd, overlapStart);
```

Analytics needs to match this exactly.

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Analytics.tsx` | Import `differenceInDays` and `addDays`, replace manual date math |

---

### Expected Result

After this fix:
- Analytics will show **68.4%** occupancy for January 2026
- Matches exactly with the Calendar's occupancy calculation
- Both use identical date arithmetic via date-fns
