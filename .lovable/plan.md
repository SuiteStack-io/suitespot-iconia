

## Add "Reservation Status" Column to Guest Forms Table

### Change — `src/pages/GuestForms.tsx`

**1. Add a new `TableHead` for "Reservation Status"** after the "Booking Ref" column (before "Check-In Status"):

```tsx
<TableHead>Reservation Status</TableHead>
```

**2. Add corresponding `TableCell`** with color-coded badges:
- `confirmed` → Blue badge, label "Confirmed"
- `checked-in` → Orange/amber badge, label "Checked In"  
- `checked-out` / `completed` → Green badge, label "Completed"

**3. Update `colSpan`** for empty state from 15 to 16.

**4. Update CSV export** to include the new "Reservation Status" column, mapping statuses to the three display labels (Confirmed, Checked In, Completed).

### File
- `src/pages/GuestForms.tsx`

