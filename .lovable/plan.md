

## Fix: Guest Forms Not Displaying Guests in Date Range

### Root Cause

Two bugs in `src/pages/GuestForms.tsx`:

1. **"Forms Completed" card filter** (line 242) requires `status === 'checked-in'`, so checked-out guests who completed forms during the date range are hidden.
2. **Date filter** (line 235) uses `isAfter()` which is exclusive — guests whose check-in falls exactly on the period start date (e.g., Jan 1 for YTD) are excluded.

### Fix

**1. Remove status restriction from card filters** (lines 242-244):
- "Completed" filter: `d.hasForm` only (no status check)
- "Pending" filter: `!d.hasForm` only (no status check)

**2. Fix date boundary** (lines 234-237):
- Replace `isAfter(date, startDate)` with `>= startDate` comparison, e.g., `parseISO(date) >= startDate`

**3. Update stats** (lines 180-182):
- "Forms Completed" count: all reservations with forms (not just checked-in)
- "Forms Pending" count: all reservations without forms (not just checked-in)
- Update card subtitles from "(Checked-in guests)" to "(In date range)" or similar

### File
- `src/pages/GuestForms.tsx`

