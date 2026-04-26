## Update date range pills on Analytics page

Rename three pill labels, fix the YTD calculation, and update each pill's date math. All edits are scoped to `src/pages/Analytics.tsx` — pill labels and `getDateRange()` only.

### Background (good news)

The pills' visible labels and their internal state values are already decoupled:

- Internal `TimePeriod` codes (used in state + switch): `'week' | 'month' | 'quarter' | 'ytd' | 'lastMonth' | 'thisMonth' | 'nextMonth'`
- Display labels (only in JSX): `7 Days`, `30 Days`, `90 Days`, `YTD`

So we only need to change the **display strings** and the **date math** inside each `case` of `getDateRange()`. The internal codes (`week`, `month`, `quarter`, `ytd`), the `TimePeriod` union, default selection (`'month'`), and downstream wiring all stay unchanged.

### Label changes (JSX only, lines ~919–922)

| Internal code | Old label | New label |
|---|---|---|
| `week` | `7 Days` | `3 months` |
| `month` | `30 Days` | `6 months` |
| `quarter` | `90 Days` | `1 yr` |
| `ytd` | `YTD` | `YTD` (unchanged) |

### Date math changes inside `getDateRange()` (lines ~237–250)

Replace the existing `switch (timePeriod)` body with:

- `case 'week'` → `subMonths(now, 3)` ... today  *(new "3 months")*
- `case 'month'` → `subMonths(now, 6)` ... today  *(new "6 months")*
- `case 'quarter'` → `subYears(now, 1)` ... today  *(new "1 yr")*
- `case 'ytd'` → `startOfYear(now)` ... today  *(fix: was hardcoded to `new Date(2025, 0, 1)`)*

For today (Apr 26, 2026), YTD will correctly produce `2026-01-01` → `2026-04-26`.

### Imports

Add `subMonths`, `subYears`, `startOfYear` to the existing `date-fns` import on line 23 (`subMonths` is already there in some form? — check; if missing, add. `format`, `startOfMonth`, `endOfMonth`, `addMonths` already imported).

Confirmed currently imported: `format, startOfMonth, endOfMonth, addMonths, isSameMonth, differenceInDays, addDays, startOfDay`. Need to **add**: `subMonths`, `subYears`, `startOfYear`.

### Things deliberately NOT changed

- Internal `TimePeriod` union and state values
- Default selected pill (`'month'`)
- Dynamic month pills (`Mar` / `Apr` / `May`) and their `lastMonth` / `thisMonth` / `nextMonth` logic
- Custom Range pill, calendar popover, `getFormattedDateRange`, and active-pill detection
- Any KPI card, chart, table, or downstream consumer (they receive resolved `startDate` / `endDate` strings, which still work)
- Pill styling and layout

### Files touched

- `src/pages/Analytics.tsx` — import line, `getDateRange()` switch body (4 cases), and 3 `TabsTrigger` label texts