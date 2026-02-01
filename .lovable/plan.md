

## Fix: Remove Manual Update of Generated "nights" Column

### Problem
The error "column 'nights' can only be updated to DEFAULT" occurs because the `nights` column is a **generated column** in PostgreSQL that automatically calculates the number of nights from `check_out_date - check_in_date`.

From the database schema:
```sql
nights INTEGER GENERATED ALWAYS AS (check_out_date - check_in_date) STORED
```

Generated columns cannot be manually updated - they're automatically computed whenever the source columns change.

### Solution
Remove the line that attempts to update `updateData.nights` in the `handleUpdateReservation` function. The column will automatically update when check-in/check-out dates are changed.

---

### Technical Change

#### File: `src/pages/BookingComReservations.tsx`

**Lines 1402-1406** - Remove the `nights` assignment:

```typescript
// BEFORE:
const nights = differenceInCalendarDays(
  parseISO(parsedData.checkOutDate), 
  parseISO(parsedData.checkInDate)
);
updateData.nights = nights;  // ❌ This causes the error
updateData.price_per_night = parsedData.totalPrice && nights > 0 
  ? parsedData.totalPrice / nights 
  : null;

// AFTER:
const nights = differenceInCalendarDays(
  parseISO(parsedData.checkOutDate), 
  parseISO(parsedData.checkInDate)
);
// Don't set updateData.nights - it's a generated column that auto-calculates
updateData.price_per_night = parsedData.totalPrice && nights > 0 
  ? parsedData.totalPrice / nights 
  : null;
```

---

### Summary

| Issue | Root Cause | Fix |
|-------|------------|-----|
| "column 'nights' can only be updated to DEFAULT" | `nights` is a generated column | Remove the line `updateData.nights = nights;` |

The `nights` variable is still needed locally to calculate `price_per_night`, but we must not include it in the update payload.

