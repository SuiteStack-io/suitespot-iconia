

## Fix: Convert Restriction Rates from Cents to Dollars in Rate Calendar

### Problem
`rate_plan_restrictions.rate` is stored in cents (e.g., 9900 = $99). Line 222 of `QuickRateGrid.tsx` uses the raw value, causing $9,900 to display instead of $99.

### Fix

**File:** `src/components/pms/QuickRateGrid.tsx`, line 222

Change:
```typescript
overrideMap[key] = Number(row.rate);
```
To:
```typescript
overrideMap[key] = Number(row.rate) / 100;
```

### Why only this line
- `rate_plan_date_overrides` stores rates in dollars (and is currently empty) — no conversion needed there
- The rest of the grid reads from `rate_plan_prices` which also stores in dollars
- This single-line fix affects both Direct and OTA calendars since OTA derives from the same `overrideMap`

### No other changes
- No database changes
- No changes to Channex sync
- No changes to other tabs

