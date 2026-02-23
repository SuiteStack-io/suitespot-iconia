

## Fix: Allow Equal Rate in "Extend Again" Price Floor Validation

### Problem

The price floor validation shows an error when the entered rate equals the previous extension's rate. This is a floating-point precision issue: the calculated floor (e.g., `total_price / 1.14 / nights`) produces a value like `82.000000001` due to IEEE 754 floating-point arithmetic, so entering exactly `82.0` fails the `currentPrice < priceFloor` check.

### Solution

**File: `src/components/ReservationQuickActions.tsx`** (line 1396-1398)

Round the `priceFloor` value to 2 decimal places when calculating it, so the comparison is clean:

```typescript
// Before
const priceFloor = firstExt && firstExtNights > 0 ? (firstExt.total_price / 1.14) / firstExtNights : 0;

// After
const priceFloor = firstExt && firstExtNights > 0 
  ? Math.floor(((firstExt.total_price / 1.14) / firstExtNights) * 100) / 100 
  : 0;
```

Using `Math.floor` with 2 decimal places ensures the floor is rounded down, so entering the same displayed rate will always pass validation. This is a single-line change.

