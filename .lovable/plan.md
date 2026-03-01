

## Fix: "Set Up Rooms" navigates to wrong page

### Problem
In `src/components/settings/PropertyForm.tsx`, the `handleSetUpRooms` function navigates to `/room-types` (line 141) instead of `/rooms`.

### Fix
Change `navigate('/room-types')` to `navigate('/rooms')` on line 141.

