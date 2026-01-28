
## Plan: Add Sortable Headers to Guest Forms Table

### Overview
Add sorting functionality to the "Check-In Status", "Form Status", and "Signed At" columns in the Guest Forms table. The headers will be clickable and display a subtle sort icon to indicate they are interactive.

---

### Visual Summary

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  CURRENT HEADERS:                                                            │
│  ┌──────────────┐ ┌─────────────┐ ┌───────────┐                             │
│  │ Check-In     │ │ Form Status │ │ Signed At │   <- Plain text headers     │
│  │ Status       │ │             │ │           │                             │
│  └──────────────┘ └─────────────┘ └───────────┘                             │
│                                                                              │
│  ↓ CHANGE TO ↓                                                              │
│                                                                              │
│  NEW HEADERS (clickable with sort icons):                                    │
│  ┌──────────────────┐ ┌─────────────────┐ ┌───────────────┐                 │
│  │ Check-In     ↕   │ │ Form Status ↕   │ │ Signed At ↕   │  <- Clickable  │
│  │ Status           │ │                 │ │               │     with icons │
│  └──────────────────┘ └─────────────────┘ └───────────────┘                 │
│                                                                              │
│  When clicked:                                                               │
│   - First click: Sort ascending (↑)                                          │
│   - Second click: Sort descending (↓)                                        │
│   - Click different column: Reset to ascending                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Technical Changes

#### File: `src/pages/GuestForms.tsx`

**1. Add new imports for sorting icons (line 54):**
```tsx
import {
  // ... existing imports
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
```

**2. Add sorting state (around line 100):**
```tsx
type SortField = 'check_in_status' | 'form_status' | 'signed_at' | null;
type SortOrder = 'asc' | 'desc';

// Inside component:
const [sortField, setSortField] = useState<SortField>(null);
const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
```

**3. Add sorting handler function (after line 345):**
```tsx
const handleSort = (field: SortField) => {
  if (sortField === field) {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  } else {
    setSortField(field);
    setSortOrder('asc');
  }
};

const getSortIcon = (field: SortField) => {
  if (sortField !== field) {
    return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
  }
  return sortOrder === 'asc' 
    ? <ArrowUp className="h-3.5 w-3.5" /> 
    : <ArrowDown className="h-3.5 w-3.5" />;
};
```

**4. Update filteredData useMemo to include sorting (lines 195-251):**
```tsx
const filteredData = useMemo(() => {
  let data = tableData;

  // ... existing filtering logic ...

  // Apply sorting
  if (sortField) {
    data = [...data].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'check_in_status':
          // Order: checked-in > checked-out > confirmed (Pending)
          const statusOrder = { 'checked-in': 1, 'checked-out': 2, 'confirmed': 3 };
          aVal = statusOrder[a.reservation.status] || 4;
          bVal = statusOrder[b.reservation.status] || 4;
          break;
        case 'form_status':
          // Completed (true) comes before Pending (false)
          aVal = a.hasForm ? 0 : 1;
          bVal = b.hasForm ? 0 : 1;
          break;
        case 'signed_at':
          aVal = a.agreement?.signed_at ? new Date(a.agreement.signed_at).getTime() : 0;
          bVal = b.agreement?.signed_at ? new Date(b.agreement.signed_at).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  return data;
}, [tableData, activeFilter, searchQuery, dateFilter, sortField, sortOrder]);
```

**5. Update table headers to be clickable (lines 565-570):**

Replace:
```tsx
<TableHead>Check-In Status</TableHead>
<TableHead>Form Status</TableHead>
...
<TableHead>Signed At</TableHead>
```

With:
```tsx
<TableHead 
  className="cursor-pointer hover:bg-muted/50 select-none"
  onClick={() => handleSort('check_in_status')}
>
  <div className="flex items-center gap-1">
    Check-In Status
    {getSortIcon('check_in_status')}
  </div>
</TableHead>
<TableHead 
  className="cursor-pointer hover:bg-muted/50 select-none"
  onClick={() => handleSort('form_status')}
>
  <div className="flex items-center gap-1">
    Form Status
    {getSortIcon('form_status')}
  </div>
</TableHead>
...
<TableHead 
  className="cursor-pointer hover:bg-muted/50 select-none"
  onClick={() => handleSort('signed_at')}
>
  <div className="flex items-center gap-1">
    Signed At
    {getSortIcon('signed_at')}
  </div>
</TableHead>
```

---

### Sorting Behavior

| Column | Ascending Order | Descending Order |
|--------|-----------------|------------------|
| Check-In Status | Checked In -> Checked Out -> Pending | Pending -> Checked Out -> Checked In |
| Form Status | Completed -> Pending | Pending -> Completed |
| Signed At | Oldest first (empty last) | Newest first (empty last) |

---

### Visual Indicators

- **Inactive column**: Subtle two-way arrow icon (ArrowUpDown) with muted color
- **Active ascending**: Single up arrow (ArrowUp) with full opacity
- **Active descending**: Single down arrow (ArrowDown) with full opacity
- **Hover state**: Light background highlight on the header cell

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/GuestForms.tsx` | Add sorting state, handler, and update table headers with click functionality and icons |

---

### Expected Result

- Three column headers ("Check-In Status", "Form Status", "Signed At") become clickable
- Each header shows a subtle sort icon to indicate interactivity
- Clicking toggles between ascending and descending order
- The active sort column's icon changes to show current direction
- Sorting integrates with existing filters (search, date, card filters)
