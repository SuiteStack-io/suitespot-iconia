

## Part B: Auto-Assign Rooms Edge Function

### Overview
Create a new edge function `auto-assign-rooms` that implements a deterministic constraint-solving algorithm for assigning rooms to unassigned reservations. This replaces the simple first-available-unit loop currently used in the Channex webhook and allocate-unit functions.

### Architecture

```text
Trigger Sources:
  1. channex-booking-webhook (after insert with unit_id=null)
  2. CreateReservationDialog (when no unit selected)
  3. Manual "Assign Rooms" action

         ↓ invoke
  ┌──────────────────────┐
  │  auto-assign-rooms   │
  │  Edge Function       │
  │                      │
  │  Input: reservation  │
  │  IDs (1 or many)     │
  │                      │
  │  Steps 1-6 algorithm │
  │  Conflict email via  │
  │  Resend              │
  └──────────────────────┘
         ↓
  Updates reservations.unit_id
  Logs to room_shuffle_log
```

### New Edge Function: `supabase/functions/auto-assign-rooms/index.ts`

**Input**: `{ reservation_ids: string[] }` — one or more reservation IDs with `unit_id = null`

**Algorithm (Steps 1-6)**:

1. **Gather inputs**: Fetch reservations by ID, group by `booking_com_name` (room type). For each group, fetch all units of that type and all existing confirmed reservations on those units within the date window (with 1-day buffer).

2. **Calculate room availability**: For each room, determine the checkout date of the last reservation ending on/before each new reservation's check-in. Room is available from that checkout onward.

3. **Sort unassigned by check-in ascending** (most constrained first).

4. **Greedy assignment**: For each reservation, find valid rooms (no overlap with existing + already-assigned). Pick tightest-fit (closest available-from date), break ties by lowest room number.

5. **Partial assignment**: If a reservation has zero valid rooms, skip it and continue. After the loop, send conflict emails for unresolvable ones via Resend.

6. **Save**: Update `reservations.unit_id` for assigned ones. Log each assignment to `room_shuffle_log`.

**Output**: `{ assigned: [{reservation_id, room_id, room_number}], conflicts: [{reservation_id, guest_name, check_in, check_out, reason}] }`

### Config
Add to `supabase/config.toml`:
```toml
[functions.auto-assign-rooms]
verify_jwt = false
```

### Integration Point Changes

**File: `supabase/functions/channex-booking-webhook/index.ts`**
After creating a reservation with `unit_id = null` (line ~414-424), invoke `auto-assign-rooms` with the new reservation ID instead of just creating an alert. Keep the alert as fallback if auto-assign returns a conflict.

**File: `src/components/CreateReservationDialog.tsx`**
When saving a reservation without a selected unit, call `auto-assign-rooms` via `supabase.functions.invoke()` after insert, then update the UI with the assigned room or show a warning if conflict.

### Conflict Email
Uses existing Resend integration. Sent to admin/front-desk users with property access (same filtering pattern as `auto-shuffle-rooms`). Subject: "Room Conflict Cannot Be Resolved". Body includes property name, guest name, dates, room type, and instruction to manually resolve.

### What stays the same
- `auto-shuffle-rooms` BFS function — unchanged, still used by `allocate-unit` for Booking.com overbooking scenarios
- `allocate-unit` — unchanged
- All existing UI, admin routes, calendar views
- Database schema — no new tables needed (uses existing `reservations`, `units`, `room_shuffle_log`)

### Files to create/modify
1. **Create** `supabase/functions/auto-assign-rooms/index.ts` — new edge function
2. **Modify** `supabase/config.toml` — add function config
3. **Modify** `supabase/functions/channex-booking-webhook/index.ts` — invoke auto-assign after unassigned reservation creation
4. **Modify** `src/components/CreateReservationDialog.tsx` — invoke auto-assign when no unit selected

