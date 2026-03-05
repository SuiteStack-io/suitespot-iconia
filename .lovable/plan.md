

## Fix Three UX Issues in Restrictions Bulk Editor

### Issue 1: Lift Pending Changes State to Parent

**Files:** `src/pages/pms/Restrictions.tsx`, `src/components/pms/BulkRestrictionEditor.tsx`

- Export the `PendingRestriction` interface from `BulkRestrictionEditor.tsx`
- Add `pendingRestrictions` and `setPendingRestrictions` to the component props interface; remove the internal `useState` for it
- In `Restrictions.tsx`, create the state: `const [pendingRestrictions, setPendingRestrictions] = useState<PendingRestriction[]>([])`
- Pass both as props to `<BulkRestrictionEditor>`
- Add a badge on the "Bulk Editor" tab trigger showing the pending count when > 0

### Issue 2: Auto-Fill Date To When Date From Is Selected

**File:** `src/components/pms/BulkRestrictionEditor.tsx`

- Replace `onSelect={setDateFrom}` (line 365) with a handler:
  ```typescript
  const handleDateFromChange = (date: Date | undefined) => {
    setDateFrom(date);
    if (date && (!dateTo || dateTo < date)) {
      setDateTo(date);
    }
  };
  ```
- Use this handler in the Date From calendar's `onSelect`

### Issue 3: Restrictions Log Table Below Calendar

**Files:** `src/components/pms/RestrictionsLogTable.tsx` (new), `src/components/pms/RestrictionCalendarView.tsx`

Create a new `RestrictionsLogTable` component that:
- Takes `ratePlans` as prop (to filter by the property's rate plans)
- Queries `rate_plan_restrictions` for all restrictions matching those rate plan IDs
- Joins with `rate_plans` to show rate plan name and room type
- Displays a table with columns: Rate Plan, Room Type, Date Range, Restrictions (badges), Synced status, Delete button
- Supports deleting individual restrictions with confirmation
- Re-fetches after deletion

Add it below the calendar in `RestrictionCalendarView.tsx`:
- Import and render `<RestrictionsLogTable>` after the Sync Status card
- Pass `ratePlans` prop and a refresh callback

### Summary of Changes

| File | Change |
|------|--------|
| `src/pages/pms/Restrictions.tsx` | Lift `pendingRestrictions` state, add badge to tab |
| `src/components/pms/BulkRestrictionEditor.tsx` | Export interface, accept props for pending state, auto-fill dateTo |
| `src/components/pms/RestrictionsLogTable.tsx` | New component — restrictions log table |
| `src/components/pms/RestrictionCalendarView.tsx` | Render RestrictionsLogTable below calendar |

