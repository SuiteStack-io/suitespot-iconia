

## Create Room Types Page for Channex Integration

### Overview

This plan creates a new "Room Types" page under ICONIA that will be the **single source of truth** for all Channex room type configurations. The page includes `max_guests` for mapping to Channex's `occ_adults`, along with all other occupancy and room count fields.

---

### Database Migration

The `units` table needs 5 new columns to support Channex room type data:

| Column | Type | Default | Channex Mapping |
|--------|------|---------|-----------------|
| `count_of_rooms` | integer | 1 | `count_of_rooms` |
| `default_occupancy` | integer | 2 | `default_occupancy` |
| `room_kind` | text | 'room' | `room_kind` |
| `max_children` | integer | 0 | `occ_children` |
| `max_infants` | integer | 0 | `occ_infants` |

**Note:** `max_guests` already exists and maps to Channex's `occ_adults`.

```sql
ALTER TABLE units 
  ADD COLUMN IF NOT EXISTS count_of_rooms integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS default_occupancy integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS room_kind text DEFAULT 'room',
  ADD COLUMN IF NOT EXISTS max_children integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_infants integer DEFAULT 0;

-- Add check constraint for room_kind values
ALTER TABLE units 
  ADD CONSTRAINT units_room_kind_check 
  CHECK (room_kind IN ('room', 'dorm'));
```

---

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/pages/RoomTypes.tsx` | **Create** | New Room Types management page |
| `src/components/SlideMenu.tsx` | Modify | Add menu item under ICONIA |
| `src/App.tsx` | Modify | Add protected route |
| `src/types/unit.ts` | Modify | Add new fields to Unit interface |

---

### Page Layout

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Room Types                                                                          [Save Changes]     │
├──────────────┬────────────┬────────────┬──────────────┬─────────────┬─────────────┬───────────────────────┤
│ Room Title   │ Room Count │ Max Guests │ Max Children │ Max Infants │ Default Occ │ Room Kind            │
├──────────────┼────────────┼────────────┼──────────────┼─────────────┼─────────────┼───────────────────────┤
│ Standard     │     3      │     2      │      1       │      0      │      2      │ [room ▼]             │
│ Deluxe Suite │     2      │     4      │      2       │      1      │      2      │ [room ▼]             │
│ Family Room  │     1      │     6      │      3       │      2      │      4      │ [room ▼]             │
└──────────────┴────────────┴────────────┴──────────────┴─────────────┴─────────────┴───────────────────────┘
```

---

### Column Details

| Column | Field | Editable | Default | Channex API Field |
|--------|-------|----------|---------|-------------------|
| Room Title | `booking_com_name \|\| name` | Read-only | - | `title` |
| Room Count | `count_of_rooms` | Yes | 1 | `count_of_rooms` |
| Max Guests | `max_guests` | Yes | 2 | `occ_adults` |
| Max Children | `max_children` | Yes | 0 | `occ_children` |
| Max Infants | `max_infants` | Yes | 0 | `occ_infants` |
| Default Occupancy | `default_occupancy` | Yes | 2 | `default_occupancy` |
| Room Kind | `room_kind` | Yes (dropdown) | 'room' | `room_kind` |

---

### Implementation Details

#### 1. New Page (`src/pages/RoomTypes.tsx`)

The page will:
- Fetch all ICONIA units (excluding private/Almaza Bay properties)
- Display in a table with inline editing
- Track changes in state until "Save Changes" is clicked
- Bulk update all modified rows to database
- Show success/error toasts

Key features:
- **Room Title**: Display-only, shows guest-facing name
- **Number inputs**: Room Count, Max Guests, Max Children, Max Infants, Default Occupancy
- **Select dropdown**: Room Kind with options "room" or "dorm"
- **Validation**: 
  - All counts ≥ 0 (Room Count ≥ 1)
  - Default Occupancy ≤ Max Guests

#### 2. Menu Item (`src/components/SlideMenu.tsx`)

Add after "Room Rates" in ICONIA section:

```typescript
{ title: 'Room Types', url: '/room-types', icon: Layers },
```

#### 3. Route (`src/App.tsx`)

```typescript
<Route path="/room-types" element={<ProtectedRoute><RoomTypes /></ProtectedRoute>} />
```

#### 4. Type Updates (`src/types/unit.ts`)

Update the Unit interface to include non-optional versions of new fields (since they have defaults):

```typescript
export interface Unit {
  // ... existing fields ...
  count_of_rooms: number;
  default_occupancy: number;
  room_kind: string;
  max_children: number;
  max_infants: number;
}
```

---

### Channex Edge Function Data Source

The Channex room type edge function will query the Room Types data like this:

```sql
SELECT 
  id,
  name,
  booking_com_name,
  count_of_rooms,
  max_guests,           -- Maps to occ_adults
  max_children,         -- Maps to occ_children
  max_infants,          -- Maps to occ_infants
  default_occupancy,
  room_kind
FROM units 
WHERE location = 'ICONIA' 
  AND (is_private = false OR is_private IS NULL);
```

This ensures **all Channex room type mappings come from a single place** - the Room Types page.

---

### Validation Rules

| Field | Rule |
|-------|------|
| Room Count | Integer ≥ 1 |
| Max Guests | Integer ≥ 1 |
| Max Children | Integer ≥ 0 |
| Max Infants | Integer ≥ 0 |
| Default Occupancy | Integer ≥ 1 AND ≤ Max Guests |
| Room Kind | Must be 'room' or 'dorm' |

---

### Admin-Only Access

The page will be accessible only to admin users (matches existing PMS section pattern). The SlideMenu already handles role-based visibility.

---

### Summary

| Item | Details |
|------|---------|
| New page | `/room-types` |
| Menu location | ICONIA section, after "Room Rates" |
| Database columns | 5 new columns |
| Fields displayed | 7 columns (1 read-only, 6 editable) |
| Source of truth | Yes - all Channex room type data managed here |

