

# Analysis: BulkRestrictionEditor Number Inputs

## Current State

The `BulkRestrictionEditor.tsx` **already has** number inputs that appear when checkboxes are checked (lines 260-288). The implementation matches the requested behavior:

- Min Stay Arrival: checkbox + conditional `<Input type="number" min={1} max={30}>` (line 267)
- Min Stay Through: checkbox + conditional `<Input type="number" min={1} max={30}>` (line 278)
- Max Stay: checkbox + conditional `<Input type="number" min={1} max={365}>` (line 286)
- Stop Sell, CTA, CTD: checkbox + conditional `<Switch>` toggle (no number needed)

The Restrictions Calendar already exists as a separate tab (`RestrictionCalendarView`) on the same page.

## Minor Improvements to Make

### 1. Change default values when checkbox is first enabled
Currently defaults to 1/1/30. Change to 2/2/30 as requested.

- Line 51: `minStayArrival` default `1` → `2`
- Line 52: `minStayThrough` default `1` → `2`

### 2. Add "nights" suffix label next to number inputs
After each `<Input>`, add a `<span className="text-xs text-muted-foreground">nights</span>` so users see the unit.

### 3. No other changes needed
- The calendar view already exists in the "Restrictions Calendar" tab
- The Channex sync, badge rendering, and date-specific overrides are all already implemented

## Files to Modify

- `src/components/pms/BulkRestrictionEditor.tsx` — change 2 default values, add 3 "nights" labels

