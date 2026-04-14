

## Add Sortable "Created" Column to Current Restrictions Table

### File: `src/components/pms/RestrictionsLogTable.tsx`

**1. Add `created_at` to the `RestrictionRow` interface**
- Add `created_at: string | null` field

**2. Add sort state**
- `sortDirection`: `'desc' | 'asc' | null` — defaults to `'desc'` (newest first)
- Sort the displayed restrictions array based on this state before rendering

**3. Change default fetch order**
- Change `.order('date_from', { ascending: true })` to `.order('created_at', { ascending: false })` so the default data arrives newest-first

**4. Add "Created" column to the table**
- Insert a new `<TableHead>` between "Restrictions" and "Sync" columns
- Make it clickable with a cursor-pointer style
- Show arrow indicator: `↓` for desc, `↑` for asc, nothing for default
- On click: cycle through desc → asc → default (reset to date_from order)
- Display: `format(new Date(r.created_at), 'MMM d, yyyy h:mm a')` or "—" if null

**5. Add corresponding `<TableCell>`**
- Between the Restrictions cell and the Sync cell
- Format the timestamp readably

### No Database Changes
The `created_at` column already exists with `DEFAULT now()`. No migration needed.

### No Other Changes
- Other columns unchanged
- Calendar grid unchanged
- Bulk Editor unchanged
- Save/sync logic unchanged

