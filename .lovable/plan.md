## Add 3 dynamic-month pills to Analytics (Mar | Apr | May)

Add three new month-snap pills to the existing time-period row on the Analytics & Reporting page (`src/pages/Analytics.tsx`), reusing the same `Tabs`/`TabsTrigger` component the existing 4 pills use so visual styling and active-state behavior come for free. Labels are dynamic month abbreviations. Date math is copied from the "Quick Select Month" block already in the file.

### 1. Files

Only `src/pages/Analytics.tsx` is touched. No new components, no new imports — `startOfMonth`, `endOfMonth`, `addMonths`, `format` are already imported on line 22.

### 2. Extend the TimePeriod union (line 41)

```ts
type TimePeriod = 'week' | 'month' | 'quarter' | 'ytd' | 'lastMonth' | 'thisMonth' | 'nextMonth';
```

Single union — `timePeriod` state and `setTimePeriod` setter are reused; no new state, no duplicate declarations.

### 3. Extend `getDateRange()` (lines 204–231)

Add a month-anchor branch right after `const now = new Date();` (line 212) and before the existing `switch`. Use `startOfMonth` / `endOfMonth` (same helpers the Quick Select Month buttons trust on lines 935–936) and format with `format(d, 'yyyy-MM-dd')` to match the timezone-safe pattern already used by the custom-range branch (lines 207–208). Return early so the `now`-based `endDate` on line 230 doesn't override the month end.

```ts
const monthAnchor =
  timePeriod === 'lastMonth' ? addMonths(now, -1) :
  timePeriod === 'thisMonth' ? now :
  timePeriod === 'nextMonth' ? addMonths(now, 1) : null;

if (monthAnchor) {
  return {
    startDate: format(startOfMonth(monthAnchor), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(monthAnchor), 'yyyy-MM-dd'),
  };
}
```

Existing 4 cases stay unchanged. `endOfMonth` correctly handles Feb 28/29 and 30/31-day months.

### 4. Add three new `TabsTrigger`s with dynamic month labels (lines 897–902)

Compute `now` once locally inside the JSX render area (a `const now = new Date();` declared right before the period-selector `<div>` on line 895 — not at module top, not duplicated; this scope has no other `now` binding so no collision).

```tsx
const now = new Date();
// ...
<TabsList>
  <TabsTrigger value="week">7 Days</TabsTrigger>
  <TabsTrigger value="month">30 Days</TabsTrigger>
  <TabsTrigger value="quarter">90 Days</TabsTrigger>
  <TabsTrigger value="ytd">YTD</TabsTrigger>
  <TabsTrigger value="lastMonth">{format(addMonths(now, -1), 'MMM')}</TabsTrigger>
  <TabsTrigger value="thisMonth">{format(now, 'MMM')}</TabsTrigger>
  <TabsTrigger value="nextMonth">{format(addMonths(now, 1), 'MMM')}</TabsTrigger>
</TabsList>
```

Today (Apr 25, 2026) → renders as `Mar | Apr | May`. Labels auto-roll on the next month change (computed every render). Same `Tabs` wrapper, same `TabsList`, same `TabsTrigger` styling. The row already wraps (`flex-wrap` on line 895) so 7 pills + Custom Range + date display lay out fine on the 1044px viewport.

### 5. Active-state and Custom Range interaction (already handled)

- Single-active-at-a-time: `Tabs value={customDateRange ? '' : timePeriod}` (line 896) already enforces this across all triggers — the new ones inherit the same one-of-N highlight.
- `handleTabChange` (line 241) already does `setCustomDateRange(undefined)` so picking any pill clears the custom range.
- Picking a custom range still sets `value=""` on the Tabs root, so all 7 pills deselect.

### 6. Date display + data refresh (already wired)

- The "Mar 25, 2026 – Apr 25, 2026" text comes from `getFormattedDateRange()` (line 959) which calls `getDateRange()` — auto-updates with the new ranges and provides the year disambiguation across Dec/Jan boundaries.
- All cards/charts already call `getDateRange()` inside their fetchers (lines 257, 377, 428, 490, 517, 542, 625, 663, 711) and re-run via `fetchAllStats` whenever `timePeriod` changes — no new data-fetching code needed.

### 7. Out of scope (do not touch)

- Visuals/behavior of the existing 4 pills, Custom Range popover, Quick Select Month buttons inside it.
- Revenue Share slider + Save button.
- Export button + Excel export.
- All KPI cards, dialogs, Revenue by Source / Room sections.
- `src/integrations/supabase/client.ts` and `types.ts`.

### Variable-collision check

- `TimePeriod` union extended in place — not redeclared.
- No new state hooks. `monthAnchor` is local inside `getDateRange()` only. `now` is local inside the JSX render scope only — no existing `now` declared at that scope.
