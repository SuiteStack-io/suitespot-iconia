

## Fix: Blocked Rooms Showing as Available in Move Room Dropdown

### Root Cause

In `fetchAvailableUnits` (line 300), the query filters units by `status = 'available'`, which excludes permanently blocked rooms. However, Room 512 likely has `status = 'available'` but has entries in the `blocked_dates` table overlapping with the reservation dates. The function never checks `blocked_dates`, so temporarily blocked rooms appear as available.

### Fix — 1 File

**File: `src/components/ReservationQuickActions.tsx`**

In `fetchAvailableUnits` (after line 313), add a query to `blocked_dates` for dates overlapping the reservation period, then merge blocked status into the `conflicts` map:

```typescript
// After fetching conflicting reservations, also fetch blocked dates
const { data: blockedDates } = await supabase
  .from("blocked_dates")
  .select("unit_id")
  .lte("start_date", reservation.check_out_date)
  .gte("end_date", reservation.check_in_date);

const blockedUnitIds = new Set((blockedDates || []).map(b => b.unit_id));
```

Then in the conflicts loop (lines 316-325), extend the conflict check:

```typescript
units?.forEach((unit) => {
  const unitResConflicts = conflictingReservations?.filter(
    (r) => r.unit_id === unit.id
  ) || [];
  const isBlocked = blockedUnitIds.has(unit.id);
  conflicts.set(unit.id, {
    hasConflict: unitResConflicts.length > 0 || isBlocked,
    conflictingReservations: unitResConflicts,
    isBlocked,
  });
});
```

Update the `ConflictInfo` interface (line 49) to add `isBlocked?: boolean`.

In the dropdown render (line 1638), show "(Blocked)" instead of "(Conflict)" when `conflict?.isBlocked`:

```tsx
{conflict?.hasConflict && (
  <span className="text-xs text-destructive ml-1">
    {conflict.isBlocked ? "(Blocked)" : "(Conflict)"}
  </span>
)}
```

### Summary
- 1 file edited: `ReservationQuickActions.tsx`
- Add `blocked_dates` query in `fetchAvailableUnits`
- Merge blocked status into conflict map
- Show "(Blocked)" label for blocked rooms, disabled and styled like conflicts

