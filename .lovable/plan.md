

## Add Selection Column with Bulk CSV Export

### Changes — `src/pages/GuestForms.tsx`

**1. Add selection state:**
```typescript
const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
```
Add toggle/select-all helpers. Clear selection when filters change.

**2. Add `#` column with checkboxes to table header** (before "Room"):
- Checkbox for select-all (checked/indeterminate based on selection state)
- `#` label

**3. Add checkbox + row number cell** (before Room cell in each row):
- Checkbox bound to `selectedRows.has(reservation.id)`
- 1-based index number

**4. Update Export CSV button:**
- When rows are selected: export only selected rows, label shows "Export Selected (N)"
- When no rows selected: export all filtered data (current behavior)

**5. Show selected count** in the count bar:
- `"X selected · Showing Y of Z guests"`

**6. Update colSpan** for empty state from 14 to 15.

**7. Add `Checkbox` import** from `@/components/ui/checkbox`.

### File
- `src/pages/GuestForms.tsx`

