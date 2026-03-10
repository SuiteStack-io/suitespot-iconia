

## Add "All Time" Date Filter to Guest Forms

### Change — `src/pages/GuestForms.tsx`

**1. Update `DateFilterType`** (line 93):
Add `'all_time'` to the union: `type DateFilterType = 'all' | 'week' | 'month' | 'ytd' | 'all_time';`

**2. Change default `dateFilter` state** (line 112):
Keep default as `'all'` (which currently shows all — but rename semantics). Actually, the current `'all'` means "no date filter applied" and shows everything. We'll add a dedicated button for "All Time" that sets `dateFilter` to `'all_time'`, which will behave the same as `'all'` (no date filtering). The difference is it will be an explicit, visually active button.

Simpler approach: Just add an "All Time" button alongside Week/Month/YTD that sets `dateFilter` to `'all'`. When active, it shows all data with no date restriction. Update the default state to `'month'` so users see month-to-date by default, with an explicit "All Time" option to see everything.

**3. Add "All Time" button** after the YTD button (~line 643):
```tsx
<Button
  variant={dateFilter === 'all' ? 'default' : 'outline'}
  size="sm"
  onClick={() => setDateFilter('all')}
>
  All Time
</Button>
```

**4. Set default dateFilter to `'month'`** (line 112):
Change from `'all'` to `'month'` so there's a meaningful default, and "All Time" becomes an opt-in choice.

**5. Update toggle behavior** on Week/Month/YTD buttons:
Currently clicking an active filter toggles back to `'all'`. Keep this behavior — clicking the active filter deselects it and goes to `'all'` (All Time).

### File
- `src/pages/GuestForms.tsx`

