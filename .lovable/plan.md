

## Improve Price Lab (Rate Editor) - Tabs, Layout, and Visual Enhancements

This is a significant UI overhaul of the Prices page and QuickRateGrid component, touching two files.

### Changes Overview

**File 1: `src/pages/pms/Prices.tsx`**

1. Rename tabs and reorder: `defaultValue="rate-plans"`, first tab "Rate Plans", second tab "Price Lab"
2. Remove `max-w-5xl mx-auto` container constraint so Price Lab can use full width

**File 2: `src/components/pms/QuickRateGrid.tsx`**

1. **14-day default view** — Change `numDays` from 7 to 14 (mobile stays at 3)
2. **View toggle (14 Days / Month)** — Add state `viewMode: '14days' | 'month'`, toggle buttons next to date nav. Month mode computes all days of the current month
3. **Navigation updates** — 14-day mode navigates by 14 days; month mode navigates by month; "Today"/"This Month" button
4. **Weekend detection fix** — Change `isWeekendHighlight` to Thursday + Friday (`day === 4 || day === 5`) instead of Friday + Saturday, matching Egypt/Middle East convention
5. **Color-coded cells** — Add `getCellColor(currentRate, baseRate, isWeekend)` function using the specified green/orange palette. Base rate is derived from the rate plan's `weekday_rate` in `prices[planId]`
6. **Variance arrows** — Show `▲` / `▼` indicators in cells when the effective rate differs from the base rate
7. **Sticky first column** — Already partially implemented; enhance with `box-shadow` for scroll indication
8. **Price variance legend** — Small legend row below the toolbar showing color meanings
9. **Narrower cells in month view** — `min-w-[70px]` in month vs `min-w-[90px]` in 14-day view

### Technical Details

**getCellColor function:**
```typescript
function getCellColor(currentRate: number, baseRate: number, isWeekend: boolean): string {
  if (baseRate === 0) return isWeekend ? '#FFF5F5' : '';
  const pct = ((currentRate - baseRate) / baseRate) * 100;
  if (Math.abs(pct) < 1) return isWeekend ? '#FFF5F5' : '';
  if (pct > 25) return '#A5D6A7';
  if (pct > 10) return '#C8E6C9';
  if (pct > 0) return '#E8F5E9';
  if (pct < -25) return '#FFCC80';
  if (pct < -10) return '#FFE0B2';
  if (pct < 0) return '#FFF3E0';
  return '';
}
```

**View mode state and day generation:**
```typescript
const [viewMode, setViewMode] = useState<'14days' | 'month'>('14days');

const days = useMemo(() => {
  if (viewMode === 'month') {
    const start = startOfMonth(weekStart);
    const end = endOfMonth(weekStart);
    return eachDayOfInterval({ start, end });
  }
  const numDays = isMobile ? 3 : 14;
  return Array.from({ length: numDays }, (_, i) => addDays(weekStart, i));
}, [weekStart, isMobile, viewMode]);
```

**Weekend highlight fix:**
```typescript
const isWeekendHighlight = (date: Date) => {
  const day = date.getDay();
  return day === 4 || day === 5; // Thursday & Friday
};
```

### Files Modified
- `src/pages/pms/Prices.tsx` — Tab rename/reorder, remove width constraint
- `src/components/pms/QuickRateGrid.tsx` — All grid enhancements (14-day default, month view, color coding, variance arrows, legend, weekend fix, sticky column shadow)

