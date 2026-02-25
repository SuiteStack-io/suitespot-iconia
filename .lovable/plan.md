

## Fix: Message Log Access for All Logged-In Users

### Root Cause
Two issues are blocking non-admin users:

1. **Route** (`src/App.tsx` line 170): The route wraps MessageLog in `<AdminRoute>`, which redirects non-admins away
2. **Sidebar** (`src/components/SlideMenu.tsx` line 117): The CUSTOMER EXCELLENCE section has `showFor: ['admin']`, hiding it from other roles

### Changes

**File: `src/App.tsx`** (line 170)
```
BEFORE: <Route path="/message-log" element={<ProtectedRoute><AdminRoute><MessageLog /></AdminRoute></ProtectedRoute>} />
AFTER:  <Route path="/message-log" element={<ProtectedRoute><MessageLog /></ProtectedRoute>} />
```
Remove the `<AdminRoute>` wrapper. `<ProtectedRoute>` alone ensures login is required.

**File: `src/components/SlideMenu.tsx`** (line 117)
```
BEFORE: showFor: ['admin'],
AFTER:  showFor: ['admin', 'manager', 'front_desk'],
```
Makes the CUSTOMER EXCELLENCE section visible to all role types.

No other files are affected.

