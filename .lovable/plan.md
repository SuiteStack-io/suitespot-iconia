

## Update Unit Type Definitions for Channex Integration

### Overview

This plan creates a centralized, shared Unit type definition that includes the new Channex-required fields (`count_of_rooms`, `max_children`, `max_infants`). This will standardize the Unit interface across the codebase and ensure consistent typing.

---

### Current Situation

| Aspect | Status |
|--------|--------|
| Local interfaces | 20+ files define their own `interface Unit` |
| Shared types | No `src/types` directory exists |
| Supabase types | Auto-generated, includes `max_guests` but awaiting migration for new fields |

**Files with local Unit interfaces:**
- `src/pages/Rooms.tsx` (most comprehensive)
- `src/pages/BookingFlow.tsx`
- `src/pages/ReservationDetail.tsx`
- `src/pages/SelectionLanding.tsx`
- `src/pages/Suites.tsx`
- `src/components/InventorySelectionModal.tsx`
- `src/components/CreateReservationDialog.tsx`
- `src/components/AvailabilityCalendar.tsx`
- `src/components/RoomCalendar.tsx`
- Plus 10+ more components

---

### Implementation Strategy

**Option A: Create Shared Types File (Recommended)**

Create a centralized types file that components can import, reducing duplication and ensuring consistency.

**Option B: Keep Local Interfaces**

Each component continues defining only the fields it needs. This is the current pattern.

I will implement **Option A** for better maintainability.

---

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/types/unit.ts` | **Create** - New shared Unit type |
| Components using Unit | **Update** - Import from shared types |

---

### Shared Unit Type Definition

The new centralized type file will export:

```typescript
// Base Unit type with all fields from database
export interface Unit {
  id: string;
  name: string;
  unit_number: string | null;
  unit_type: string | null;
  unit_size: string | null;
  status: string;
  booking_com_id: string | null;
  booking_com_name: string | null;
  comments: string | null;
  beds: number | null;
  baths: number | null;
  max_guests: number | null;
  sofa_bed: boolean | null;
  price_per_night: number | null;
  weekend_rate: number | null;
  tax_percentage: number | null;
  photos: string[] | null;
  view: string | null;
  location: string | null;
  address: string | null;
  map_description: string | null;
  latitude: number | null;
  longitude: number | null;
  is_private: boolean | null;
  min_stay: number | null;
  estimated_cleaning_minutes: number | null;
  features: string[] | null;
  payment_terms: string | null;
  created_at: string;
  updated_at: string;
  // New Channex fields
  count_of_rooms: number;
  max_children: number;
  max_infants: number;
}

// Partial type for components that only need some fields
export type PartialUnit = Partial<Unit> & Pick<Unit, 'id' | 'name'>;

// Channex-specific subset for sync operations
export interface ChannexUnit {
  id: string;
  name: string;
  count_of_rooms: number;
  max_guests: number;
  max_children: number;
  max_infants: number;
}
```

---

### Component Updates

Each component will be updated to import from the shared types:

**Before:**
```typescript
interface Unit {
  id: string;
  name: string;
  max_guests: number | null;
  // ... duplicated fields
}
```

**After:**
```typescript
import { Unit } from '@/types/unit';
// OR for components needing fewer fields:
import { PartialUnit } from '@/types/unit';
```

---

### Priority Components to Update

The following components are most likely to use the new Channex fields and should be updated first:

| Component | Reason |
|-----------|--------|
| `src/pages/Rooms.tsx` | Main room management, needs all fields |
| `src/components/InventorySelectionModal.tsx` | Shows room details |
| `src/pages/ReservationDetail.tsx` | May show occupancy limits |
| `src/components/CreateReservationDialog.tsx` | Guest count validation |

---

### Benefits

1. **Single source of truth** - One definition to update when schema changes
2. **Type safety** - Consistent types across all components
3. **Channex ready** - New fields immediately available everywhere
4. **Maintainable** - Easier to add/remove fields in the future
5. **IntelliSense** - Better autocomplete in editors

---

### Database Type Sync

After the migration runs, the Supabase types at `src/integrations/supabase/types.ts` will automatically include:

```typescript
// Auto-generated after migration
units: {
  Row: {
    // ... existing fields ...
    count_of_rooms: number | null
    max_children: number | null
    max_infants: number | null
  }
}
```

The shared type file will align with these auto-generated types while providing explicit documentation and defaults.

---

### Implementation Steps

1. Create `src/types/unit.ts` with the shared Unit interface
2. Update `src/pages/Rooms.tsx` to import and use the shared type
3. Update `src/components/InventorySelectionModal.tsx`
4. Update other high-priority components
5. Leave low-priority components for future refactoring (they can continue using local interfaces until needed)

