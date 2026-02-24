

## Hide Extension Bookings from Guests Page

Extension bookings (with booking references like `-EXT`, `-EXT2`, `-EXT3`) are duplicates of the original booking and should be excluded from the Guests page by default.

### Change

**File: `src/pages/Guests.tsx`**

In the `fetchGuests` function (around line 123), when iterating over reservations to build guest records, skip any reservation whose `booking_reference` contains `-EXT` (case-insensitive). This filters them out before they ever enter the guest list, so they won't appear in the table, CSV exports, or counts.

**Single line addition** inside the `reservations?.forEach` loop, before pushing records:

```typescript
reservations?.forEach((reservation) => {
  // Skip extension bookings (duplicates of original)
  if (reservation.booking_reference?.includes('-EXT')) return;
  
  reservation.guest_names?.forEach(...);
});
```

This is a simple, clean approach -- extensions are never created as guest records, so they're excluded from all views, filters, and exports automatically.
