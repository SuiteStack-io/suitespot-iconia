

## Fix: Remove Global Unique Constraint on `unit_number`

### Problem
The `units` table has a `UNIQUE` constraint on `unit_number` (`units_unit_number_key`) that is global — meaning no two rooms across any property can share the same unit number. This causes:
1. Clone Room fails with "duplicate key value violates unique constraint" when the target number already exists
2. Add Room silently fails (error message says generic "Failed to add room" without showing the actual database error)

### Fix

**1. Database migration** — Drop the global unique constraint and replace with a per-property unique constraint:
```sql
ALTER TABLE public.units DROP CONSTRAINT IF EXISTS units_unit_number_key;
CREATE UNIQUE INDEX units_unit_number_property_key 
  ON public.units (property_id, unit_number) 
  WHERE unit_number IS NOT NULL;
```

**2. `src/pages/Rooms.tsx`** — Update `handleAddRoom` error handling (around line 560) to show the actual error message from the database instead of the generic "Failed to add room":
```typescript
description: error.message || 'Failed to add room',
```

### Files
- Database migration: Drop `units_unit_number_key`, add composite unique index on `(property_id, unit_number)`
- `src/pages/Rooms.tsx`: ~1 line change to show actual error message in add-room handler

