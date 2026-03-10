

## Make Month Filter "Month to Date"

### Change — `src/pages/GuestForms.tsx`

**1. Add an `endDate` cap** to the date filter logic (around line 232):
- For `'month'`: `endDate = now` (today, not end of month)
- For `'week'`: `endDate = now` (today, not end of week) — keep consistent
- For `'ytd'`: already implicitly MTD since `endDate` isn't set

Add `endDate = now` for all period filters, then filter: `check_in_date <= endDate` in addition to the existing `>= startDate` check. This excludes future reservations.

**2. Update the filter condition** (lines 233-236):
```
data = data.filter(d => {
  const checkIn = parseISO(d.reservation.check_in_date);
  const checkOut = parseISO(d.reservation.check_out_date);
  return (checkIn >= startDate && checkIn <= endDate) ||
         (checkOut >= startDate && checkOut <= endDate) ||
         (checkIn <= startDate && checkOut >= endDate);
});
```
This properly captures stays that overlap the date range window (start of month → today).

**3. Update the button label** (lines 594-596):
- Change `format(new Date(), 'MMMM yyyy')` to `'MTD'` or `format(new Date(), 'MMM')  + ' to Date'` when active, to signal it's month-to-date.

### File
- `src/pages/GuestForms.tsx`

