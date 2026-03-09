

## Align Rate & Restrictions Form Fields

### File: `src/components/pms/BulkRestrictionEditor.tsx` (lines 396-465)

Standardize all numeric input rows to use consistent sizing and right-side units:

- All inputs: `w-24 h-9 text-right`
- All unit labels: `text-sm text-muted-foreground w-12` (fixed width for alignment)
- Replace `$` with `USD`
- Description text stays at `text-[10px]`

#### Rate row (lines 396-408)
```tsx
<div className="flex items-center gap-3">
  <Checkbox checked={enableRate} onCheckedChange={(v) => setEnableRate(!!v)} />
  <Label className="text-sm flex-1">
    Rate
    <span className="block text-[10px] text-muted-foreground font-normal">Set the nightly rate for this date range</span>
  </Label>
  {enableRate && (
    <div className="flex items-center gap-2">
      <Input type="number" min={0} step={0.01} value={rate} onChange={(e) => setRate(parseFloat(e.target.value) || 0)} className="w-24 h-9 text-right" />
      <span className="text-sm text-muted-foreground w-12">USD</span>
    </div>
  )}
</div>
```

#### Min Stay Arrival (lines 410-422), Min Stay Through (lines 424-436), Max Stay (lines 438-447)
Same pattern — wrap input+unit in `<div className="flex items-center gap-2">`, use `w-24 h-9 text-right` on input, `text-sm text-muted-foreground w-12` on "nights" span.

#### Stop Sell, CTA, CTD rows (lines 449-465)
No change needed (they use Switch, no numeric input).

### Summary
Single file, lines 396-465. Consistent `w-24 h-9 text-right` inputs with fixed-width right-side unit labels.

