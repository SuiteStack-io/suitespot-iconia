

## Fix "All Time" Filter to Show All Guest Forms

### Root Cause

The database query on line 167 filters reservations to only `checked-in`, `checked-out`, and `confirmed` statuses. Reservations that have been completed (status `completed`) are excluded at the query level, so they never appear regardless of the date filter selected.

### Change — `src/pages/GuestForms.tsx`

**1. Include `completed` status in the query** (line 167):

Change:
```typescript
.in('status', ['checked-in', 'checked-out', 'confirmed'])
```
To:
```typescript
.in('status', ['checked-in', 'checked-out', 'confirmed', 'completed'])
```

**2. Remove the `.lte('check_in_date', today)` filter** (line 168):

This server-side date filter prevents future confirmed reservations from appearing, which is fine — but it also clips historical data unnecessarily when combined with the "All Time" client-side filter. Since the client-side date filter already handles date ranges, removing this server-side constraint lets "All Time" fetch everything.

Alternatively, only remove the `.lte` when "All Time" is selected — but since the client-side filter already handles week/month/ytd filtering, removing it entirely is simpler and the client filter handles the rest.

**3. Handle the 1000-row query limit**: Add `.limit(5000)` or use pagination if needed to ensure all 46+ forms are returned (default Supabase limit is 1000, so 46 should be fine without changes).

### File
- `src/pages/GuestForms.tsx`

