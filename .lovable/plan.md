

## Fix: Ambiguous Foreign Key in Extension Notification

### Problem

The `send-extension-notification` edge function query on line 34 uses `units(name, unit_number)` which is ambiguous because the `reservations` table has two foreign keys pointing to `units`:
- `unit_id` (the assigned room)
- `shuffled_from_unit_id` (the room before a shuffle)

PostgREST cannot determine which relationship to use and returns error `PGRST201`.

### Solution

**File: `supabase/functions/send-extension-notification/index.ts`** (line 34)

Disambiguate the join by specifying the foreign key:

```typescript
// Before
.select('*, units(name, unit_number)')

// After
.select('*, units!reservations_unit_id_fkey(name, unit_number)')
```

This tells PostgREST to use the `unit_id` foreign key, which is the correct one for getting the assigned room details. Single-line fix.

