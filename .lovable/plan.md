
## Plan: Display Booking.com Names in Suite Name Column

### Current State

Looking at the screenshot and code, the "Suite Name" column on the Rooms Management page shows internal suite names like:
- "Deluxe One Bedroom Suite"
- "Family Suite"  
- "Junior One Bedroom Suite"

But these should display the **booking.com names** instead (which are already stored in the database).

### Visual Summary

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    BEFORE                                           │
├─────┬─────────────────────────┬────────┬──────────────────────────┐
│ Nr  │ Suite Name              │ Room # │ ... Booking.com Name     │
├─────┼─────────────────────────┼────────┼──────────────────────────┤
│  1  │ Deluxe One Bedroom Suite│  506   │ ... [Duplicate column]   │
│  2  │ Family Suite            │  417   │ ... [Duplicate column]   │
└─────┴─────────────────────────┴────────┴──────────────────────────┘

                              ⬇

┌─────────────────────────────────────────────────────────────────────┐
│                    AFTER                                            │
├─────┬─────────────────────────┬────────┬──────────────────────────┐
│ Nr  │ Suite Name              │ Room # │ ... (column removed)     │
├─────┼─────────────────────────┼────────┼──────────────────────────┤
│  1  │ Suite with Terrace      │  506   │ ...                      │
│  2  │ Family Suite (2-BR)     │  417   │ ...                      │
└─────┴─────────────────────────┴────────┴──────────────────────────┘
```

---

### Technical Changes

#### File: `src/pages/Rooms.tsx`

**1. Update table header (line 892)**

Change header label to reflect it now shows booking.com names:
```tsx
// Before
<th>Suite Name</th>

// After  
<th>Suite Name</th>  // Keep the same label for consistency
```

**2. Update table body cell (lines 1130-1143)**

Change the data cell to display `booking_com_name` instead of `name`:

```tsx
// Before (line 1141)
unit.name

// After
unit.booking_com_name || unit.name
```

**3. Update new room row (lines 944-950)**

Update the input to edit `booking_com_name` when adding a new room:

```tsx
// Before
<Input
  value={newUnit.name}
  onChange={(e) => setNewUnit({ ...newUnit, name: e.target.value })}
  placeholder="Room name"
/>

// After
<Input
  value={newUnit.booking_com_name || ''}
  onChange={(e) => setNewUnit({ ...newUnit, booking_com_name: e.target.value })}
  placeholder="Room name"
/>
```

**4. Update edit mode (lines 1131-1138)**

Change the edit input to use `booking_com_name`:

```tsx
// Before
value={isBulkEdit ? bulkEditUnits[unit.id]?.name : editedUnit.name}
onChange={(e) => 
  isBulkEdit 
    ? handleBulkEditChange(unit.id, 'name', e.target.value)
    : setEditedUnit({ ...editedUnit, name: e.target.value })
}

// After
value={isBulkEdit ? (bulkEditUnits[unit.id]?.booking_com_name || '') : (editedUnit.booking_com_name || '')}
onChange={(e) => 
  isBulkEdit 
    ? handleBulkEditChange(unit.id, 'booking_com_name', e.target.value)
    : setEditedUnit({ ...editedUnit, booking_com_name: e.target.value })
}
```

---

### Summary of Changes

| Location | Current Value | New Value |
|----------|---------------|-----------|
| Table data cell (line 1141) | `unit.name` | `unit.booking_com_name \|\| unit.name` |
| Edit mode input (lines 1131-1138) | Uses `name` field | Uses `booking_com_name` field |
| Add room input (lines 944-950) | Uses `name` field | Uses `booking_com_name` field |

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Rooms.tsx` | Update Suite Name column to display and edit `booking_com_name` instead of `name` |
