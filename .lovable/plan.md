

## Plan: Update Reservations List Table Columns

### Changes Required

1. **Rename "Suite Name" to "Room Name"** and display the `booking_com_name` field instead of the internal `name` field
2. **Add a "Source" column** immediately after "Guest Name(s)" to show:
   - "Booking.com" for booking.com reservations (when source contains "booking")
   - The actual source name (e.g., "Emad Rezk", "Nikola Bagaric") for direct reservations

---

### Technical Changes

#### File: `src/components/ReservationsList.tsx`

**1. Update Reservation interface (line 72)**

Add `booking_com_name` to the units type:
```tsx
// FROM:
units: { name: string; unit_number: string | null } | null;

// TO:
units: { name: string; unit_number: string | null; booking_com_name: string | null } | null;
```

**2. Update query to fetch booking_com_name (line 214)**

```tsx
// FROM:
...units(name, unit_number)')

// TO:
...units(name, unit_number, booking_com_name)')
```

**3. Rename "Suite Name" header to "Room Name" (line 1086)**

```tsx
// FROM:
Suite Name {getSortIcon('units')}

// TO:
Room Name {getSortIcon('units')}
```

**4. Update cell to display booking_com_name (line 1200)**

```tsx
// FROM:
{reservation.units?.name || 'N/A'}

// TO:
{reservation.units?.booking_com_name || reservation.units?.name || 'N/A'}
```

**5. Add new "Source" table header after Guest Name(s) header (after line 1095)**

Insert a new TableHead column after "Guest Name(s)":
```tsx
<TableHead 
  className="cursor-pointer hover:bg-muted/50"
  onClick={() => handleSort('source')}
>
  Source {getSortIcon('source')}
</TableHead>
```

**6. Add new "Source" table cell after Guest Name(s) cell (after line 1228)**

Insert a new TableCell after the Guest Name(s) cell:
```tsx
<TableCell 
  className="cursor-pointer"
  onClick={() => navigate(`/reservation/${reservation.id}`)}
>
  {reservation.source?.toLowerCase().includes('booking') 
    ? 'Booking.com' 
    : reservation.source || 'N/A'}
</TableCell>
```

**7. Remove duplicate Source column from later in the table (lines 1134-1138 header, line 1296-1301 cell)**

Since we're adding the Source column after Guest Name(s), we should remove the existing Source column that appears later in the table to avoid duplication.

**8. Update colSpan for empty state row (line 1179)**

Verify the colSpan accounts for the new column layout (columns being reorganized, not added net new).

---

### Column Order After Changes

| Position | Column Name |
|----------|-------------|
| 1 | Checkbox |
| 2 | **Room Name** (was "Suite Name", now shows booking_com_name) |
| 3 | Room # |
| 4 | Guest Name(s) |
| 5 | **Source** (new position - shows "Booking.com" or admin name) |
| 6 | Check-in |
| 7 | Check-out |
| ... | (remaining columns continue) |

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/ReservationsList.tsx` | Update interface, query, header, cells, and column organization |

---

### Expected Result

- The first room column will be titled "Room Name" and display the Booking.com room name (e.g., "Double Room with Terrace") with fallback to internal name
- A "Source" column will appear right after "Guest Name(s)" showing:
  - "Booking.com" for reservations from booking.com
  - "Emad Rezk", "Nikola Bagaric", etc. for direct reservations made by admin team members

