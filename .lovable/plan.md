

## Add PMS Navigation Section with Three New Pages

### Overview

Add a new "PMS" (Property Management System) section to the hamburger menu containing three pages that are **admin-only**:
- **Availability** - Manage room availability across properties
- **Prices** - Manage pricing and rate configurations  
- **Restrictions** - Manage booking restrictions and rules

Additionally, add a `can_access_pms` permission toggle in the Edit Permissions dialog for future flexibility.

---

### Technical Changes

#### 1. Database: Add PMS Permission Column

Add a new boolean column `can_access_pms` to the `user_permissions` table.

```sql
ALTER TABLE user_permissions 
ADD COLUMN can_access_pms boolean NOT NULL DEFAULT false;
```

---

#### 2. Update Auth Context

**File: `src/lib/auth.tsx`**

Add `can_access_pms` to the UserPermissions interface:

```typescript
export interface UserPermissions {
  can_check_in: boolean;
  can_check_out: boolean;
  can_submit_forms: boolean;
  can_create_booking: boolean;
  can_change_rooms: boolean;
  can_block_dates: boolean;
  can_export_calendar: boolean;
  can_access_pms: boolean;  // NEW
}
```

Update `DEFAULT_PERMISSIONS` and `fetchUserPermissions` to include the new field.

---

#### 3. Update Edit Permissions Dialog

**File: `src/components/EditPermissionsDialog.tsx`**

Add PMS permission toggle:

```typescript
const PERMISSION_LABELS = {
  // ... existing permissions
  can_access_pms: { 
    label: 'Access PMS', 
    description: 'Access to Availability, Prices, and Restrictions pages' 
  },
};
```

Update the state initialization and handleToggleAll function to include `can_access_pms`.

---

#### 4. Update Slide Menu Navigation

**File: `src/components/SlideMenu.tsx`**

Add the new PMS section with a Lock icon:

```typescript
import { Lock } from 'lucide-react';

// Insert after ICONIA section, before MANAGEMENT
{
  label: 'PMS',
  items: [
    { title: 'Availability', url: '/pms/availability', icon: CalendarDays },
    { title: 'Prices', url: '/pms/prices', icon: DollarSign },
    { title: 'Restrictions', url: '/pms/restrictions', icon: Lock },
  ],
  showFor: ['admin'],
},
```

---

#### 5. Create Three New Page Components

Each page follows the existing admin page pattern with:
- Header with hamburger menu and title
- AdminBreadcrumb navigation
- "Coming Soon" placeholder content

**File: `src/pages/pms/Availability.tsx`**

```typescript
// Standard admin page layout with:
// - SlideMenu in header
// - AdminBreadcrumb section="PMS" currentPage="Availability"
// - Placeholder content: "Manage room availability"
```

**File: `src/pages/pms/Prices.tsx`**

```typescript
// - AdminBreadcrumb section="PMS" currentPage="Prices"
// - Placeholder content: "Manage pricing and rates"
```

**File: `src/pages/pms/Restrictions.tsx`**

```typescript
// - AdminBreadcrumb section="PMS" currentPage="Restrictions"
// - Placeholder content: "Manage booking restrictions"
```

---

#### 6. Add Routes to App.tsx

**File: `src/App.tsx`**

```typescript
import PMSAvailability from "./pages/pms/Availability";
import PMSPrices from "./pages/pms/Prices";
import PMSRestrictions from "./pages/pms/Restrictions";

// In Routes (before catch-all):
<Route path="/pms/availability" element={<ProtectedRoute><PMSAvailability /></ProtectedRoute>} />
<Route path="/pms/prices" element={<ProtectedRoute><PMSPrices /></ProtectedRoute>} />
<Route path="/pms/restrictions" element={<ProtectedRoute><PMSRestrictions /></ProtectedRoute>} />
```

---

### File Summary

| File | Action | Description |
|------|--------|-------------|
| Database migration | Create | Add `can_access_pms` column to `user_permissions` |
| `src/lib/auth.tsx` | Modify | Add `can_access_pms` to UserPermissions interface |
| `src/components/EditPermissionsDialog.tsx` | Modify | Add PMS permission toggle |
| `src/components/SlideMenu.tsx` | Modify | Add PMS section with 3 menu items (admin-only) |
| `src/pages/pms/Availability.tsx` | Create | New page for availability management |
| `src/pages/pms/Prices.tsx` | Create | New page for price management |
| `src/pages/pms/Restrictions.tsx` | Create | New page for restrictions management |
| `src/App.tsx` | Modify | Add routes for 3 new PMS pages |

---

### Access Control

- **Menu visibility**: PMS section only appears for admin users (`showFor: ['admin']`)
- **Permission toggle**: `can_access_pms` added to Edit Permissions dialog for future use if non-admin access is needed
- **Route protection**: All PMS routes wrapped in `ProtectedRoute` requiring authentication

