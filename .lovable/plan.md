

## Group Rooms by Title on Room Types Page

### Problem

Currently each unit row in the `units` table is displayed as a separate row on the Room Types page. For Channex integration, rooms with the same title (e.g., 5 "Deluxe Suite" units) should appear as **one row** with `count_of_rooms = 5`.

---

### Solution

Group units by their display name (`booking_com_name || name`) and show aggregated data. When saving, update all units in that group with the same values.

---

### Implementation Changes

**File:** `src/pages/RoomTypes.tsx`

#### 1. Add Grouped Room Type Interface

```typescript
interface GroupedRoomType {
  displayName: string;
  unitIds: string[];  // All unit IDs with this room type
  count_of_rooms: number;  // Number of units in this group
  max_guests: number;
  max_children: number;
  max_infants: number;
  default_occupancy: number;
  room_kind: string;
}
```

#### 2. Create Grouping Logic

Add a function to group rooms by display name:

```typescript
const groupRoomsByType = (rooms: RoomTypeData[]): GroupedRoomType[] => {
  const groups: Record<string, GroupedRoomType> = {};
  
  rooms.forEach(room => {
    const displayName = room.booking_com_name || room.name;
    
    if (!groups[displayName]) {
      groups[displayName] = {
        displayName,
        unitIds: [room.id],
        count_of_rooms: 1,
        max_guests: room.max_guests ?? 2,
        max_children: room.max_children ?? 0,
        max_infants: room.max_infants ?? 0,
        default_occupancy: room.default_occupancy ?? 2,
        room_kind: room.room_kind ?? 'room',
      };
    } else {
      groups[displayName].unitIds.push(room.id);
      groups[displayName].count_of_rooms += 1;
    }
  });
  
  return Object.values(groups).sort((a, b) => 
    a.displayName.localeCompare(b.displayName)
  );
};
```

#### 3. Update State Management

Change from tracking by unit ID to tracking by display name:

| Before | After |
|--------|-------|
| `editedData: Record<string, EditedRoomType>` (keyed by unit ID) | `editedData: Record<string, GroupedRoomType>` (keyed by display name) |

#### 4. Update Save Logic

When saving, apply changes to **all units** in the group:

```typescript
const handleSave = () => {
  const updates: { id: string; data: EditedRoomType }[] = [];
  
  Object.entries(editedData).forEach(([displayName, groupData]) => {
    // Apply same values to all units in this group
    groupData.unitIds.forEach(unitId => {
      updates.push({
        id: unitId,
        data: {
          count_of_rooms: groupData.count_of_rooms,
          max_guests: groupData.max_guests,
          max_children: groupData.max_children,
          max_infants: groupData.max_infants,
          default_occupancy: groupData.default_occupancy,
          room_kind: groupData.room_kind,
        },
      });
    });
  });
  
  updateMutation.mutate(updates);
};
```

#### 5. Update Table Rendering

Render grouped data instead of individual units:

```typescript
{groupedRoomTypes.map((group) => (
  <TableRow key={group.displayName}>
    <TableCell className="font-medium">{group.displayName}</TableCell>
    <TableCell>
      {/* Read-only: shows count of units with this room type */}
      <span className="text-muted-foreground">{group.count_of_rooms}</span>
    </TableCell>
    {/* ... other editable fields ... */}
  </TableRow>
))}
```

---

### Important Notes

| Field | Behavior |
|-------|----------|
| Room Title | Display name (grouped key) - read-only |
| Room Count | **Auto-calculated** from number of units with same title - read-only |
| Max Guests | Editable - applies to all units in group |
| Max Children | Editable - applies to all units in group |
| Max Infants | Editable - applies to all units in group |
| Default Occ | Editable - applies to all units in group |
| Room Kind | Editable - applies to all units in group |

The `count_of_rooms` field becomes **read-only** because it reflects the actual number of unit records sharing that room type name.

---

### Summary

| Item | Change |
|------|--------|
| Display | Group units by `booking_com_name \|\| name` |
| Room Count | Auto-calculated, read-only |
| Editable fields | Shared across all units in group |
| Save behavior | Updates all units in each group |

