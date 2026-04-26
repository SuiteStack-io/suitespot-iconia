## Split month pills into standalone outlined buttons on Analytics

Splits the current single `TabsList` containing 7 pills into two visually distinct groups, with a responsive stacked layout on mobile.

### Changes to `src/pages/Analytics.tsx`

**Replace lines 915–926** (the `<div className="flex items-center gap-4 flex-wrap">` opener through the closing `</Tabs>`) with:

```tsx
<div className="flex items-center gap-4 flex-wrap">
  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
    <Tabs value={customDateRange ? '' : timePeriod} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="week">7 Days</TabsTrigger>
        <TabsTrigger value="month">30 Days</TabsTrigger>
        <TabsTrigger value="quarter">90 Days</TabsTrigger>
        <TabsTrigger value="ytd">YTD</TabsTrigger>
      </TabsList>
    </Tabs>

    <div className="flex items-center gap-2">
      {(['lastMonth', 'thisMonth', 'nextMonth'] as const).map((key, idx) => {
        const monthDate = idx === 0 ? addMonths(now, -1) : idx === 1 ? now : addMonths(now, 1);
        const label = format(monthDate, 'MMM');
        const isActive = !customDateRange && timePeriod === key;
        return (
          <Button
            key={key}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleTabChange(key)}
            className={isActive ? 'border-foreground border-2' : ''}
          >
            {label}
          </Button>
        );
      })}
    </div>
  </div>
```

The existing `<Popover>...` for Custom Range (lines 928+) remains a sibling within the outer flex-wrap row, unchanged.

### Behavior preserved

- `TimePeriod` union, `getDateRange()`, `handleTabChange`, KPI cards, tables, Custom Range — all unchanged
- Single-active-at-a-time: Tabs `value` only matches `week|month|quarter|ytd`, so selecting a month deselects the segmented group; selecting a segment makes none of the month buttons match `timePeriod === key`, deselecting them
- `now` (line 882), `Button`, `addMonths`, `format`, `customDateRange`, `timePeriod`, `handleTabChange` — all already in scope, no redeclarations

### Responsive layout

- Mobile (`<sm`): `flex-col` stacks the segmented Tabs group above the three month buttons
- Desktop (`≥sm`): `sm:flex-row` places both groups side by side with `sm:gap-4`
- Custom Range button continues to flow after both groups via the outer `flex-wrap` container
