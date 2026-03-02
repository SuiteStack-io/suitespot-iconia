

## Analysis

The data is actually correct. The "Best Available Rate" for Twin Room has `valid_from = 2026-11-22` and `valid_to = 2026-11-22` with rates $333/$370. This plan only applies on Nov 22 -- it's working as designed.

The problem is the **Prices page doesn't display the validity dates** on the plan card. Without that context, "Base: $333" looks like the permanent default rate when it's actually a date-specific override.

## Fix

**File: `src/pages/pms/Prices.tsx`** (lines ~371-386)

Add validity date display to each rate plan card:
- After the plan name and badges, show the date range when `valid_from` and/or `valid_to` are set
- Format as a badge like "Nov 22, 2026" (single day) or "Nov 22 – Dec 31, 2026" (range)
- This makes it immediately clear which plans are permanent vs date-specific

The plan card will go from:
```
Best Available Rate  [Flexible - 1 day before check-in]
Base: $333 wkday / $370 wknd · 1 night min
```
To:
```
Best Available Rate  [Flexible - 1 day before check-in]  [Nov 22, 2026]
Base: $333 wkday / $370 wknd · 1 night min
```

