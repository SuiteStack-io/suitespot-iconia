

## Plan: Add Quick Date Filters to Revenue Analytics

### Current State

The Revenue Analytics page has:
1. **Time period tabs**: Week, Month, Quarter, YTD (line 948-955)
2. **Custom date range picker**: A popover with a calendar for custom date selection (line 957-984)

The user wants to add **quick month filters** (like "December", "January", "February") below the existing date range, similar to the pattern used in the Export PDF date selector in AvailabilityCalendar.

### Visual Design Reference

From the screenshots, the design should look like:

```text
┌─────────────────────────────────────────────────────────────────────┐
│                          [ Week ] [Month] [Quarter] [YTD]           │
│                                                                     │
│                      📅  Dec 30, 2025 - Jan 30, 2026               │
│                                                                     │
│                  [December] [January] [February]  ← NEW             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

The quick month filters will:
- Show 3 buttons: Previous Month, Current Month, Next Month
- Use the same button style as the export PDF selector (outline variant)
- Highlight the selected month with a different variant (e.g., `default` instead of `outline`)
- Update the date range when clicked

---

### Technical Changes

#### File: `src/pages/Analytics.tsx`

**1. Add required imports (line 20)**

Add `startOfMonth`, `endOfMonth`, `addMonths`, `isSameMonth` from date-fns:

```tsx
// Before
import { format } from 'date-fns';

// After
import { format, startOfMonth, endOfMonth, addMonths, isSameMonth } from 'date-fns';
```

**2. Add a helper function to check if current date range matches a month (after line 213)**

```tsx
const isMonthSelected = (monthDate: Date): boolean => {
  if (!customDateRange?.from || !customDateRange?.to) return false;
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  return isSameMonth(customDateRange.from, monthStart) && 
         isSameMonth(customDateRange.to, monthEnd) &&
         customDateRange.from.getDate() === 1 &&
         customDateRange.to.getDate() === monthEnd.getDate();
};
```

**3. Add the quick month filter UI (after line 984, before line 987)**

Insert the quick month filter buttons between the date range display and the dashboard cards:

```tsx
{/* Quick Month Filters */}
<div className="flex justify-center gap-2 pt-2">
  <Button
    variant={isMonthSelected(addMonths(new Date(), -1)) ? 'default' : 'outline'}
    size="sm"
    onClick={() => {
      const lastMonth = addMonths(new Date(), -1);
      setCustomDateRange({
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth)
      });
    }}
  >
    {format(addMonths(new Date(), -1), 'MMMM')}
  </Button>
  <Button
    variant={isMonthSelected(new Date()) ? 'default' : 'outline'}
    size="sm"
    onClick={() => {
      setCustomDateRange({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date())
      });
    }}
  >
    {format(new Date(), 'MMMM')}
  </Button>
  <Button
    variant={isMonthSelected(addMonths(new Date(), 1)) ? 'default' : 'outline'}
    size="sm"
    onClick={() => {
      const nextMonth = addMonths(new Date(), 1);
      setCustomDateRange({
        from: startOfMonth(nextMonth),
        to: endOfMonth(nextMonth)
      });
    }}
  >
    {format(addMonths(new Date(), 1), 'MMMM')}
  </Button>
</div>
```

---

### How It Works

1. **Button Click**: When user clicks a month button (e.g., "January"), it calls `setCustomDateRange` with:
   - `from`: First day of that month (e.g., Jan 1, 2026)
   - `to`: Last day of that month (e.g., Jan 31, 2026)

2. **Visual Feedback**: The `isMonthSelected` helper checks if the current custom date range matches a full month, and applies the `default` variant (filled button) instead of `outline`

3. **Integration**: Since `customDateRange` is already used by `getDateRange()`, changing it automatically updates all analytics data

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Analytics.tsx` | Add date-fns imports, helper function, and quick month filter buttons |

---

### Expected Result

After implementation:
- Three month buttons appear below the date range display
- Clicking a month instantly updates the date range to that full month
- The selected month button appears filled/highlighted
- All analytics data refreshes for the selected month period
- Matches the design pattern from the Export PDF date selector

