

## Restrict Rooms, Room Types, and Room Rates to Admin Only

### Changes

**1. Sidebar: Hide menu items for non-admin users**

**File: `src/components/SlideMenu.tsx`**

Add `showFor: ['admin']` to the three menu items in the ICONIA section:
- `Rooms` (url: `/rooms`)
- `Room Types` (url: `/room-types`)
- `Room Rates` (url: `/room-rates`)

The existing filtering logic already handles `showFor` on individual items -- items with `showFor` are only shown to matching roles. No new logic needed.

**2. Route protection: Block direct URL access**

**File: `src/components/ProtectedRoute.tsx`**

Create an `AdminRoute` wrapper component (or add it in `App.tsx` inline) that checks `userRole === 'admin'` from `useAuth()`. If not admin, redirect to `/admin`.

**File: `src/App.tsx`**

Wrap the three routes (`/rooms`, `/room-types`, `/room-rates`) with the new `AdminRoute` component inside `ProtectedRoute`:

```
<Route path="/rooms" element={<ProtectedRoute><AdminRoute><Rooms /></AdminRoute></ProtectedRoute>} />
```

### Technical Details

| File | Change |
|------|--------|
| `src/components/SlideMenu.tsx` | Add `showFor: ['admin']` to Rooms, Room Types, Room Rates menu items |
| `src/components/AdminRoute.tsx` | New component: checks `userRole` from `useAuth()`, redirects non-admins to `/admin` |
| `src/App.tsx` | Wrap 3 routes with `AdminRoute` |

No database or edge function changes needed.

