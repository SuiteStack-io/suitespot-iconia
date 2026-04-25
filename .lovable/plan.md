## Make the 4 bottom tables on Analytics respect the date range pills

### Problem (verified by reading each file)

`Analytics.tsx` already computes `{ startDate, endDate }` from the active pill / Custom Range and passes it to each of the four tables as `mainDateRange={{ from: new Date(startDate), to: new Date(endDate) }}` (lines 1168–1173). The bug is inside the four child components:

| Component | Current behavior | Bug |
|---|---|---|
| `RevenueBySource` | `useEffect(() => fetch(), [])` and the fetch query has **no date filter, no property filter** | Ignores date range completely. Queries entire reservations table all-time, all properties. |
| `RevenueByRoom` | Re-fetches on date change, but query uses `gte('check_in_date', start) AND lte('check_out_date', end)` | This is containment (reservation must START on/after `start` AND END on/before `end`) — drops every reservation that straddles either boundary. Differs from KPI cards. |
| `RevenueByGuests` | Same containment bug as RevenueByRoom + no property filter | Wrong window + cross-property leakage |
| `RevenueByNationality` | Uses `check_in_date BETWEEN start AND end` (matches KPI pattern), but no property filter | Cross-property leakage |

### Source of truth — the KPI pattern to copy verbatim

User said: *"if KPIs don't prorate, match THAT — consistency with KPI cards is more important than proration."*

Inspected `Analytics.tsx`. Almost every KPI fetch (lines 277–281, 301–305, 312–316, 396–400, 459–463, 510–513, 537–540, 561–565, 652–656, 690–694, 730–733) uses the exact same five-line pattern:

```ts
await withPropertyFilter(
  supabase
    .from('reservations')
    .select(...)
    .neq('status', 'Cancelled')        // status filter
    .is('cancelled_at', null)           // cancellation exclusion
    .gte('check_in_date', startDate)    // window start
    .lte('check_in_date', endDate),     // window end (check_in only, NOT overlap)
  propertyId,
);
```

The only KPI that uses an overlap pattern is the Occupancy nights calc (lines 346–350), and only because it needs to count partial nights. **Every revenue/booking KPI uses the simple `check_in_date BETWEEN start AND end` pattern.** The four tables must use that pattern too.

**No proration.** A reservation either falls in the window (check-in inside `[start, end]`) and counts at full revenue, or it does not count at all. This matches every revenue KPI on the page.

### Fixes per file

#### 1. `src/components/RevenueBySource.tsx`

- Add `import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter'`.
- Inside the component: `const propertyId = usePropertyId();`.
- Replace the `useEffect(() => { fetchRevenueBySource(); ... }, [])` so the dep array is `[mainDateRange?.from?.getTime(), mainDateRange?.to?.getTime(), propertyId]`. Keep the realtime channel subscription inside the same effect.
- Inside `fetchRevenueBySource`: early-return if `!mainDateRange?.from || !mainDateRange?.to`. Compute `startDate = format(mainDateRange.from, 'yyyy-MM-dd')`, `endDate = format(mainDateRange.to, 'yyyy-MM-dd')`. Wrap the query in `withPropertyFilter(..., propertyId)` and add the four KPI filters:
  ```ts
  .neq('status', 'Cancelled')
  .is('cancelled_at', null)
  .gte('check_in_date', startDate)
  .lte('check_in_date', endDate)
  ```
- No other logic changes — aggregation, commission rates, modal, export, expand/collapse all stay.

#### 2. `src/components/RevenueByRoom.tsx`

Already imports `usePropertyId` and `withPropertyFilter` and already uses them. Only the date filter is wrong.

- In `fetchRevenueByRoom` (line 174–180), change `.lte('check_out_date', endDate)` → `.lte('check_in_date', endDate)`. The full filter becomes the KPI pattern:
  ```ts
  .neq('status', 'Cancelled')
  .is('cancelled_at', null)
  .gte('check_in_date', startDate)
  .lte('check_in_date', endDate)
  ```
- Remove the local `dateRange` `useState` + sync `useEffect` (lines 47–62). Drive everything directly off `mainDateRange` and add it to the fetch effect's deps as `[mainDateRange?.from?.getTime(), mainDateRange?.to?.getTime(), propertyId]`. (The local-state indirection adds nothing now that the page is the single source of truth and creates a one-render lag.)
- Replace `dateRange?.from`/`dateRange?.to` references inside `fetchRevenueByRoom` with `mainDateRange?.from`/`mainDateRange?.to`.
- Keep `daysDiff` calculation and per-room occupancy formula as-is.

#### 3. `src/components/RevenueByGuests.tsx`

- Add `import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter'` and `const propertyId = usePropertyId();`.
- Remove the local `dateRange` `useState` + sync `useEffect` (lines 29–44). Drive directly off `mainDateRange`.
- In `fetchGuestRevenues`: wrap query in `withPropertyFilter(..., propertyId)` and switch the date filter to the KPI pattern:
  ```ts
  .neq('status', 'Cancelled')
  .is('cancelled_at', null)
  .gte('check_in_date', startDate)
  .lte('check_in_date', endDate)
  ```
  (was `.gte('check_in_date', start) .lte('check_out_date', end)` — wrong)
- Update fetch effect deps to `[mainDateRange?.from?.getTime(), mainDateRange?.to?.getTime(), propertyId]`.

#### 4. `src/components/RevenueByNationality.tsx`

Date filter already matches the KPI pattern (`check_in_date BETWEEN`). Only missing piece is property scoping.

- Add `import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter'` and `const propertyId = usePropertyId();`.
- Wrap the query in `withPropertyFilter(..., propertyId)`.
- Remove the local `dateRange` `useState` + sync `useEffect` (lines 32–51). Drive directly off `mainDateRange`. (Note the existing fallback default `new Date(2024, 10, 1)` is unreachable in practice because `Analytics.tsx` always passes a range, but removing the indirection avoids the one-render lag.)
- Add `.is('cancelled_at', null)` to match KPI exclusion (currently uses only `.in('status', [...])` — the KPIs combine BOTH `.neq('status', 'Cancelled')` and `.is('cancelled_at', null)`). To preserve this component's existing positive-status filter, keep `.in('status', ['confirmed', 'checked-in', 'checked-out', 'completed'])` and just add `.is('cancelled_at', null)`. This is strictly stricter — cancelled rows already absent from the status whitelist, so the new filter is a no-op for correctness but matches KPI intent verbatim.
- Update fetch effect deps to `[mainDateRange?.from?.getTime(), mainDateRange?.to?.getTime(), propertyId]`.
- Leave VAT-divisor logic, sources/payments aggregation, sorting, and rendering untouched.

#### 5. `src/pages/Analytics.tsx` — no logic changes

The page already computes `{ startDate, endDate }` once at line 876 from `getDateRange()` and passes the same range to all four tables (lines 1168–1173). No changes needed in the page itself; the bug was entirely inside the children.

### Out of scope (not touched)

- KPI cards, ADR/RevPAR row, Revenue Share slider, Save button, pills, Custom Range picker, Export button, Occupancy by Month chart, Cancellation Analytics, all dialogs, all sort/expand/UI behavior of the four tables.

### Verification (post-implementation, manual eyeball)

After the fix, with the same pill selected:

- Sum of `Bookings` column in `Revenue by Source` should equal the `Total Bookings` KPI card.
- Sum of `Net Revenue` column in `Revenue by Source` should equal the Net Revenue KPI card.
- Sum of `Revenue` (net) column in `Revenue by Room` should equal the Net Revenue KPI card (within rounding).
- Switching pills (7 Days → Mar → YTD → Custom) re-fetches all four tables in one coordinated update.

### Variable-collision check

- `RevenueBySource`: new identifiers `propertyId`, `startDate`, `endDate`. None clash with existing names.
- `RevenueByRoom`: removing `dateRange` state + setter; existing `startDate`/`endDate` locals inside `fetchRevenueByRoom` still single-declared (just sourced from `mainDateRange` now).
- `RevenueByGuests`: removing `dateRange`/`setDateRange`. New `propertyId`. No clash.
- `RevenueByNationality`: removing `dateRange`/`setDateRange`. New `propertyId`. No clash.
- All `useEffect` dep arrays updated in place — no duplicate effects added.
