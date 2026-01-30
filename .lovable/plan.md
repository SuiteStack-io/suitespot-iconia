

## Plan: Remove Date Pickers from Revenue Tables

### Summary

Remove the individual date range selector buttons from **Revenue by Room**, **Revenue by Nationality**, and **Revenue by Guests** tables. These tables will use only the main date range specified at the top of the Analytics page.

---

### Changes by Component

#### 1. `src/components/RevenueByRoom.tsx`

**Remove the date picker UI** (lines 295-328):
- Remove the `Popover` with the calendar date picker
- Keep only the location tabs and Expand/Collapse button
- The component already syncs with `mainDateRange` via `useEffect`, so data fetching will continue working

**Remove unused imports**:
- `Calendar` from '@/components/ui/calendar'
- `Popover, PopoverContent, PopoverTrigger` from '@/components/ui/popover'
- `CalendarIcon` from 'lucide-react'

**Simplify state**:
- Remove `setDateRange` from the `useState` since `dateRange` will only be set via the `useEffect` sync

---

#### 2. `src/components/RevenueByNationality.tsx`

**Remove the date picker UI** (lines 180-213):
- Remove the `Popover` with the calendar in the `CardHeader`
- Simplify `CardHeader` to just show the title

**Remove unused imports**:
- `Calendar` from '@/components/ui/calendar'
- `Popover, PopoverContent, PopoverTrigger` from '@/components/ui/popover'
- `CalendarIcon` from 'lucide-react'
- `Button` from '@/components/ui/button'
- `cn` from '@/lib/utils'

---

#### 3. `src/components/RevenueByGuests.tsx`

**Remove the date picker UI** (lines 162-195):
- Remove the `Popover` with the calendar
- Keep only the nationality filter dropdown

**Remove unused imports**:
- `Calendar` from '@/components/ui/calendar'
- `Popover, PopoverContent, PopoverTrigger` from '@/components/ui/popover'
- `CalendarIcon` from 'lucide-react'
- `cn` from '@/lib/utils'

---

### Files to Modify

| File | Change |
|------|--------|
| `src/components/RevenueByRoom.tsx` | Remove date picker Popover and unused imports |
| `src/components/RevenueByNationality.tsx` | Remove date picker Popover and unused imports |
| `src/components/RevenueByGuests.tsx` | Remove date picker Popover and unused imports |

---

### Result

All three revenue tables will automatically use the date range selected at the top of the Analytics page (Week/Month/Quarter/YTD or custom date picker). Users will have a single, unified date control for all analytics data.

