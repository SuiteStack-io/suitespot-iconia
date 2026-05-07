## Goal

Align revenue figures in the weekly and monthly summary emails with the Analytics page's `revenue_recognition_method` (`check_in` | `check_out` | `prorata`).

## Files

### 1. New: `supabase/functions/_shared/revenue-filter.ts`

Create with the exact content provided in the request — exports `RevenueRecognitionMethod`, `applyRevenueDateFilter`, and `prorateFactor`. (Mirrors `src/lib/revenueDateFilter.ts` but Deno-friendly without date-fns.)

### 2. `supabase/functions/generate-weekly-summary/index.ts`

- Add import: `import { applyRevenueDateFilter, prorateFactor, type RevenueRecognitionMethod } from "../_shared/revenue-filter.ts";`
- Change property select from `"id, name, currency"` to `"id, name, currency, revenue_recognition_method"`.
- After `const currency = property.currency || "USD";` add:
  `const revenueMethod: RevenueRecognitionMethod = (property.revenue_recognition_method as RevenueRecognitionMethod) || "check_in";`
- Refactor `computeWeekRevenue(supabase, propertyId, start, end)` → `computeWeekRevenue(supabase, propertyId, start, end, method)`:
  - Build base query with `.select("total_price, commission_amount, check_in_date, check_out_date")`, status/cancelled filters, `.eq("property_id", propertyId)`.
  - Apply `applyRevenueDateFilter(baseQuery, method, start, end)` instead of hardcoded check-in date filter.
  - Sum loop: when `method === 'prorata'`, multiply `(gross - comm)` by `prorateFactor(r.check_in_date, r.check_out_date, start, end)`; otherwise unchanged.
- Update the call inside the 4-week loop to pass `revenueMethod`.

### 3. `supabase/functions/generate-monthly-summary/index.ts`

- Same import added.
- Property select includes `revenue_recognition_method`.
- Add `const revenueMethod: RevenueRecognitionMethod = (property.revenue_recognition_method as RevenueRecognitionMethod) || "check_in";` after the currency line.
- Refactor `fetchRevenueData(supabase, propertyId, start, end)` → `fetchRevenueData(supabase, propertyId, start, end, method)`:
  - Select adds `check_in_date, check_out_date`.
  - Replace hardcoded `.gte("check_in_date", start).lte("check_in_date", end)` with `applyRevenueDateFilter(query, method, start, end)`.
  - Returns raw rows (unchanged shape, plus dates).
- Pass `revenueMethod` to every `fetchRevenueData` call (current month, prior month, last-year, 6-month trend loop).
- Update every revenue aggregation site to apply prorata when needed. Introduce a small local helper inside the handler:
  ```ts
  const sumRevenue = (rows: any[], rangeStart: string, rangeEnd: string) => {
    let gross = 0, comm = 0;
    for (const r of rows) {
      const f = revenueMethod === 'prorata'
        ? prorateFactor(r.check_in_date, r.check_out_date, rangeStart, rangeEnd)
        : 1;
      gross += (r.total_price || 0) * f;
      comm  += (r.commission_amount || 0) * f;
    }
    return { gross, comm, net: gross - comm };
  };
  ```
  Use it to compute: `grossRevenue`/`totalCommission`/`netRevenue` (current month range), `priorGross`/`priorComm`/`priorNet` (prior range), `lyGross`/`lyComm`/`lyNet` (LY range), and `mGross`/`mC`/`mNet` inside the 6-month trend loop (using each month's `mRange.start/end`).
- `revenueData`/`priorRevData`/`lyRevData` array references that are still used elsewhere (e.g. `lyHasData = lyRevData.length > 0 || ...`) remain intact.

## Out of scope

- No changes to landlord / `has_landlord` logic.
- No changes to occupancy, bookings, check-in/check-out queries, or rendering.
- No DB schema changes (`revenue_recognition_method` already exists on `properties`).
