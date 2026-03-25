

## Fix: Allow property deletion when all bookings are cancelled

### Problem
`PropertyList.tsx` line 42-48 counts **all** reservations for each property. Even after cancelling every booking, the count is still > 0, so the toast "existing bookings" blocks the delete dialog from opening.

### Fix — `src/components/settings/PropertyList.tsx`

**Lines 42-48**: Add a filter to the reservations query to only count active bookings (exclude `cancelled`, `completed`, and `checked-out` statuses):

```tsx
// Before
supabase
  .from('reservations')
  .select('property_id')

// After
supabase
  .from('reservations')
  .select('property_id')
  .not('status', 'in', '("cancelled","completed","checked-out")')
```

This way, cancelled/completed/checked-out reservations no longer block deletion. Only properties with active bookings (confirmed, checked-in, etc.) will show the error toast.

### What stays the same
- Delete confirmation dialog with name typing
- Actual deletion logic in `DeletePropertyDialog`
- Default property protection (no trash icon shown)

