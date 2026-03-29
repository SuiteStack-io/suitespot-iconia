

## Add Check-in and Check-out Date Range Filters

### Current State
The existing "Select date range" date picker (line 879-912) already filters by **check-in date** (lines 357-362). It needs to be renamed to "Check-in" and a new "Check-out" filter added.

### Changes — Single File: `src/components/ReservationsList.tsx`

**1. Add new state** (after line 148):
```ts
const [checkOutDateRange, setCheckOutDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
```

**2. Add `checkOutDateRange` to the `useEffect` dependency array** (line 207).

**3. Add check-out date filtering** in `filterReservations()` (after line 362):
```ts
if (checkOutDateRange.from) {
  filtered = filtered.filter(r => new Date(r.check_out_date) >= checkOutDateRange.from!);
}
if (checkOutDateRange.to) {
  filtered = filtered.filter(r => new Date(r.check_out_date) <= checkOutDateRange.to!);
}
```

**4. Rename existing date picker** (line 898): Change "Select date range" to "Check-in date range".

**5. Add a new Check-out date range picker** — duplicate the existing Popover block (lines 879-912), placed right after it, using `checkOutDateRange` state with label "Check-out date range".

**6. Update "Clear Dates" button** (lines 983-992): Also clear `checkOutDateRange`, and show the button when either date range is set.

### No other changes
- Table columns, data, existing filters, Create Reservation button — all unchanged.

