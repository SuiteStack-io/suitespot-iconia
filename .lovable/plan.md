

## Remove Extension Bookings from Guest Forms

Extension bookings (booking references containing `-EXT`) are duplicates of original stays where guests already completed their check-in form. They should be excluded from the Guest Forms page, matching the pattern already used in the Guests page.

### Change — `src/pages/GuestForms.tsx`

**Filter out extensions in the data processing step** (around line 163, after fetching reservations):

Add a filter before setting state to exclude any reservation whose `booking_reference` contains `-EXT`:

```typescript
const filtered = (reservationsData || []).filter(
  r => !r.booking_reference?.includes('-EXT')
);
setReservations(filtered);
```

This is a single-line addition that mirrors the existing pattern in `src/pages/Guests.tsx` (line 165).

### File
- `src/pages/GuestForms.tsx`

