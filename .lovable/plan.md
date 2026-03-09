

## Add Availability Sync Preview to Rooms Page

### What the user wants
After adding or cloning rooms, show a "pending availability sync" banner (like the restrictions editor pattern) that previews the new unit counts per room type, with a "Save Changes" button to push updated availability to Channex in bulk.

### How it works today
- Adding/cloning rooms inserts units into the DB and refreshes the list
- No automatic Channex availability sync is triggered (DB triggers only fire on reservation/blocked_date changes)
- User must manually go to Channex Integration page and run Full Sync

### Plan

**1. Add pending sync state to Rooms page** (`src/pages/Rooms.tsx`)

After `handleAddRoom` and `handleCloneRoom` succeed, compute the new unit count for the affected `booking_com_name` group and add an entry to a `pendingAvailabilitySync` state array. Each entry stores: `booking_com_name`, `property_id`, `newUnitCount` (total units with that name minus maintenance).

**2. Add a "Pending Availability Sync" card** (`src/pages/Rooms.tsx`)

Display a card (similar to the Bulk Availability Editor's pending changes card) at the top of the page when `pendingAvailabilitySync.length > 0`. Shows each affected room type and its new unit count. Includes:
- Individual remove buttons (X) per entry
- A "Sync to Channex" button that calls `channex-push-availability` with the updated counts for a 500-day window
- `beforeunload` warning when pending items exist

**3. Sync logic**

When "Sync to Channex" is clicked:
- For each pending entry, build an update payload: `{ property_id, room_type_id: <any unit ID with that booking_com_name>, date_from: today, date_to: today+500days, availability: newUnitCount }`
- Call `channex-push-availability` edge function (which already resolves mappings via `booking_com_name`)
- On success, clear pending state and show success toast
- Deduplicate entries: if the same `booking_com_name` is added/cloned multiple times, keep only the latest count

**4. Count calculation**

After add/clone succeeds and `fetchUnits()` completes, recalculate from the refreshed `units` state:
```
units.filter(u => u.booking_com_name === name && u.status !== 'maintenance').length
```

This reuses the existing `channex-push-availability` edge function — no backend changes needed.

### Files to modify
- `src/pages/Rooms.tsx` — add pending sync state, sync card UI, and trigger logic after add/clone

