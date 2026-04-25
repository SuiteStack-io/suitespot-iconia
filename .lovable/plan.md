## Goal

Add a 4th step "Revenue Settings" to the Edit Property modal with one new field (Revenue Recognition Method), and wire that setting into all revenue calculations on the Analytics page (KPI cards, the 4 bottom tables, and the Occupancy by Month chart's revenue toggle).

---

## 1. Database migration

Add one column to `public.properties`:

```sql
ALTER TABLE public.properties
  ADD COLUMN revenue_recognition_method text NOT NULL DEFAULT 'check_in'
  CHECK (revenue_recognition_method IN ('check_in', 'check_out', 'prorata'));
```

The column will ride along on the existing `select('*')` already used by `PropertyContext.fetchProperties` — no other query changes needed.

---

## 2. Edit Property modal — `src/components/settings/PropertyForm.tsx`

The file is the existing wizard (currently 3 steps in edit mode, 4 in create mode where step 4 is the success screen).

### 2a. Restructure step numbering

- Rename existing "STEP 4: Success" block to render at `step === 5` instead, and bump the relevant `setStep(4)` after create to `setStep(5)`.
- Insert a new STEP 4 = "Revenue Settings".
- Update `totalSteps` so both edit and create show **4** numbered steps in the title and progress bar (`Step X of 4`). The success screen (now step 5) keeps the title "Property Created!" and stays excluded from the indicator (mirroring current behavior with `step < 4` → change to `step < 5`).

### 2b. Form state additions

Add to the `useState` form initializer:

```ts
revenue_recognition_method:
  (property as any)?.revenue_recognition_method || 'check_in',
```

### 2c. Step 4 UI

Render when `step === 4`:

- Label "Revenue Recognition Method" with a small muted lucide `Info` icon directly to its right.
- Click on the icon opens an existing `Popover` (same component used in `CreateReservationDialog.tsx` / `BookingWidget.tsx`) with the three definitions exactly as specified in the prompt (Upon check-in / Upon check-out / Pro-rata nights).
- A `Select` (same `@/components/ui/select` already used in steps 1–3) with options:
  - `Upon check-in` → `check_in`
  - `Upon check-out` → `check_out`
  - `Pro-rata nights` → `prorata`

### 2d. Save / navigation

- Step 3's "Next" button advances to step 4 (no save).
- Step 4's primary button is the existing Save / Update button (`Update Property` in edit, `Create Property` in create), which calls the existing `handleSave`.
- Add `revenue_recognition_method: form.revenue_recognition_method` to the `payload: any` in `handleSave` (cast `any` already in place — types not yet regenerated).
- After successful update in edit mode, the existing `onSaved()` flow already triggers `refreshProperties` upstream; on create, the existing flow advances to the success screen.

---

## 3. New helper — `src/lib/revenueDateFilter.ts`

Create a small standalone module with:

```ts
export type RevenueRecognitionMethod = 'check_in' | 'check_out' | 'prorata';

export function applyRevenueDateFilter<T>(
  query: T,
  method: RevenueRecognitionMethod,
  startDate: string,
  endDate: string,
): T {
  if (method === 'check_in') {
    return (query as any).gte('check_in_date', startDate).lte('check_in_date', endDate);
  }
  if (method === 'check_out') {
    return (query as any).gte('check_out_date', startDate).lte('check_out_date', endDate);
  }
  // prorata: overlap (matches the Occupancy KPI's overlap pattern)
  return (query as any).lte('check_in_date', endDate).gte('check_out_date', startDate);
}
```

And a per-reservation prorate helper used only when `method === 'prorata'`:

```ts
export function prorateFactor(
  checkInISO: string,
  checkOutISO: string,
  startISO: string,
  endISO: string,
): number {
  // Uses the EXACT overlap math copied from Analytics.tsx lines 362–371.
  // Returns nights_in_window / total_nights, or 0 if no overlap.
}
```

---

## 4. Analytics page wiring — `src/pages/Analytics.tsx`

### 4a. Read the active method

Add near the existing `useProperty()` usage:

```ts
const method: RevenueRecognitionMethod =
  ((activeProperty as any)?.revenue_recognition_method as RevenueRecognitionMethod) ?? 'check_in';
```

Add `method` to the `useEffect` deps that already trigger refetch on date-range changes.

### 4b. Replace revenue-related date filters

For every revenue fetcher, replace the literal `.gte('check_in_date', startDate).lte('check_in_date', endDate)` with `applyRevenueDateFilter(query, method, startDate, endDate)`. Affected fetchers (line numbers from current file):

- `fetchAllStats`:
  - revenue stats query (~L274) — Total Revenue / Net Revenue / Commission / source split.
  - total bookings count query (~L298).
  - total guests query (~L309).
- `fetchDirectSourceDetails` (~L393).
- `fetchBookingsDetails` (~L506) — keep `.order('check_in_date', { ascending: false })`.
- `fetchGuestsDetails` (~L533).
- `fetchSourcesDetails` (~L558).
- `fetchTotalRevenueDetails` per-unit query (~L648).
- `fetchNetRevenueDetails` per-unit query (~L686).
- `fetchCommissionDetails` (~L727).

For each fetcher, when `method === 'prorata'`, multiply each reservation's `total_price`, `commission_amount`, and derived `net_revenue` (= total_price − commission_amount) by `prorateFactor(...)` before summing/grouping. Counts (e.g. `Total Bookings`) under `prorata` are still the count of overlapping reservations — full count, no proration of the integer.

### 4c. Occupancy KPI is left alone

Lines 336–387 (units fetch, `reservations` overlap fetch ~L344, `unitIdSet` overlap loop, blocked-date count, occupancy %) stay unchanged — they already use the overlap pattern and measure nights, not revenue.

ADR / RevPAR: only the revenue numerator changes (taken from the new method-aware `revenueStats.netRevenue` / `totalRevenue`); denominators (`totalNights`, `totalAvailableRooms`) stay tied to the existing overlap nights calc.

### 4d. Pass `method` to the 4 bottom tables

Update the renders at L1168–1173:

```tsx
<RevenueBySource     mainDateRange={...} method={method} />
<RevenueByRoom       mainDateRange={...} method={method} />
<RevenueByGuests     mainDateRange={...} method={method} />
<RevenueByNationality mainDateRange={...} method={method} />
```

In each component:

- Add `method?: RevenueRecognitionMethod` to its props (default `'check_in'`).
- Add `method` to the `useEffect` deps.
- Replace the existing `.gte('check_in_date', startDate).lte('check_in_date', endDate)` with `applyRevenueDateFilter(query, method, startDate, endDate)`.
- When `method === 'prorata'`, multiply `total_price`, `commission_amount`, and `net_revenue` per reservation by `prorateFactor(...)` before aggregating into the table rows.

### 4e. Occupancy by Month chart — `src/components/analytics/OccupancyByMonthChart.tsx`

- Add `method?: RevenueRecognitionMethod` prop (default `'check_in'`); pass from Analytics at L1164.
- The existing reservations query (already an overlap query) stays — it's needed for occupancy regardless. Add `'check_in'` and `'check_out'` to the existing select.
- In the per-month bucket loop, change ONLY the revenue contribution (occupancy stays as-is):
  - `prorata` → existing `netForReservation * (nightsInMonth / totalNights)` math (unchanged).
  - `check_in` → if the reservation's `check_in_date` falls inside `[m.monthStart, m.monthEnd]`, contribute the full `total_price − commission_amount` to that month; else contribute 0.
  - `check_out` → same, but on `check_out_date`.

### 4f. Out of scope

No changes to: weekly summary emails, `landlord_share_percentage` math / Revenue Share slider, date-range pills, Custom Range picker, Export button, KPI card / table visuals, Steps 1–3 of the modal.

---

## Files touched

- **Migration**: add `revenue_recognition_method` column to `properties`.
- **New file**: `src/lib/revenueDateFilter.ts`.
- **Edited**:
  - `src/components/settings/PropertyForm.tsx` (add Step 4, renumber success → step 5, payload field).
  - `src/pages/Analytics.tsx` (read `method`, swap filters in 9 fetchers, pass `method` to 4 tables + chart, prorate when needed).
  - `src/components/RevenueBySource.tsx`
  - `src/components/RevenueByRoom.tsx`
  - `src/components/RevenueByGuests.tsx`
  - `src/components/RevenueByNationality.tsx`
  - `src/components/analytics/OccupancyByMonthChart.tsx`

Default for all existing properties is `'check_in'`, which preserves today's exact KPI behavior on the Analytics page.
