

## Move Room Calendar to PMS Availability Page

### Overview

Move the complete Room Calendar functionality from the current `/calendar` page to the PMS Availability page (`/pms/availability`). This makes the PMS > Availability page the primary location for viewing and managing room availability.

---

### Technical Changes

#### 1. Update PMS Availability Page

**File: `src/pages/pms/Availability.tsx`**

Replace the placeholder content with the full Room Calendar implementation from Calendar.tsx:

```typescript
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { RoomCalendar } from '@/components/RoomCalendar';
import { BlockedDatesManager } from '@/components/BlockedDatesManager';
import { MobileCalendarView } from '@/components/MobileCalendarView';
import { useIsMobile } from '@/hooks/use-mobile';
import suitespotLogo from '@/assets/suitespot-logo.png';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';

const PMSAvailability = () => {
  const { user, loading, userRole } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // ... auth check logic from Calendar.tsx

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <AdminBreadcrumb section="PMS" currentPage="Availability" />
          <div className="flex items-center gap-4">
            <SlideMenu userRole={userRole} />
            <img src={suitespotLogo} alt="SuiteSpot Logo" className="h-10 w-10 object-contain" />
            <div>
              <h1 className="text-xl font-bold">Room Calendar</h1>
              <p className="text-sm text-muted-foreground">View and manage room bookings</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {isMobile ? (
          <MobileCalendarView />
        ) : (
          <>
            <RoomCalendar />
            <BlockedDatesManager />
          </>
        )}
      </main>
    </div>
  );
};
```

---

#### 2. Update AdminBreadcrumb

**File: `src/components/AdminBreadcrumb.tsx`**

Add PMS section path mapping in `getSectionPath()`:

```typescript
case "PMS":
  return "/pms/availability";
```

---

#### 3. Update SlideMenu Navigation

**File: `src/components/SlideMenu.tsx`**

Remove the old "Calendar" item from ICONIA section (line 85):

```typescript
// Remove this line:
{ title: 'Calendar', url: '/calendar', icon: CalendarDays },
```

The PMS section already has the Availability link.

---

#### 4. Redirect Old Calendar Route

**File: `src/pages/Calendar.tsx`**

Convert the old Calendar page to redirect to the new location:

```typescript
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Calendar = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/pms/availability', { replace: true });
  }, [navigate]);

  return null;
};

export default Calendar;
```

This ensures any bookmarked links or external references to `/calendar` still work.

---

### File Summary

| File | Action | Description |
|------|--------|-------------|
| `src/pages/pms/Availability.tsx` | Modify | Add full Room Calendar functionality (RoomCalendar, BlockedDatesManager, MobileCalendarView) |
| `src/components/AdminBreadcrumb.tsx` | Modify | Add "PMS" section path mapping |
| `src/components/SlideMenu.tsx` | Modify | Remove "Calendar" from ICONIA section |
| `src/pages/Calendar.tsx` | Modify | Convert to redirect to `/pms/availability` |

---

### What Stays the Same

- All calendar functionality (filters, location toggle, booking display, drag-and-drop)
- Mobile calendar view behavior
- Blocked dates manager
- Desktop/mobile responsive layout
- All styling and visual indicators

