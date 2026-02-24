

## Fix: Dashboard Card Detail Modals Not Fetching Reservations

### Root Cause

The `reservations` table has two foreign keys pointing to the `units` table:
- `unit_id` (the current room)
- `shuffled_from_unit_id` (the previous room after a shuffle)

On **line 329** of `src/components/Dashboard.tsx`, the `baseSelect` query string uses an implicit join:

```
units(name, booking_com_name, unit_number)
```

PostgREST cannot resolve which foreign key to use, so the query fails silently and returns `null`. This is why:
- **Card counts work** -- they use simple `select('id')` without the ambiguous join
- **Modal detail lists show "No reservations found"** -- they use `baseSelect` with the broken join

### Fix

**File: `src/components/Dashboard.tsx`, line 329**

Change:
```typescript
const baseSelect = '*, units(name, booking_com_name, unit_number), check_in_agreements(id)';
```

To:
```typescript
const baseSelect = '*, units!unit_id(name, booking_com_name, unit_number), check_in_agreements(id)';
```

Adding `!unit_id` explicitly tells PostgREST which foreign key to use for the join, resolving the ambiguity.

### Scope

- Single line change in one file
- No database changes needed
- All six modal views (Arrivals, Departures, In-House, New Bookings, Cancellations, Transfers) will be fixed since they all use `baseSelect`

