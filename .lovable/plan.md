

## Room Auto-Shuffle System

This is a significant feature that adds intelligent room rearrangement when a new booking arrives and no rooms of the requested type are immediately available. Instead of flagging a false conflict, the system tries to move existing (non-checked-in) bookings between rooms of the same type to free up space.

---

### Database Changes

**New table: `room_shuffle_log`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| shuffle_date | timestamptz | When the shuffle occurred |
| triggered_by_booking_id | uuid | The new reservation that caused the shuffle |
| triggered_by_reference | text | Booking reference for display |
| room_type | text | The room type (booking_com_name) involved |
| moves | jsonb | Array of move objects (see below) |
| move_count | integer | Number of moves in the chain |
| reason | text | Human-readable reason |
| created_at | timestamptz | Default now() |

Each entry in the `moves` JSONB array:
```text
{
  "reservation_id": "uuid",
  "guest_name": "John Doe",
  "from_room_id": "uuid",
  "from_room_number": "509",
  "to_room_id": "uuid",
  "to_room_number": "511",
  "check_in": "2026-03-01",
  "check_out": "2026-03-05"
}
```

RLS policies:
- Admin SELECT/INSERT/DELETE
- System INSERT (for edge function with service role)

**New column on `reservations` table:**
- `shuffled_from_unit_id` (uuid, nullable) -- stores the original room before auto-shuffle
- `shuffled_at` (timestamptz, nullable) -- when the shuffle happened
- `shuffle_log_id` (uuid, nullable) -- reference to the shuffle log entry

---

### New Edge Function: `auto-shuffle-rooms`

This is the core logic, implemented as a standalone edge function that can be called by both the Channex webhook and the `allocate-unit` function.

**Input:**
```text
{
  roomType: string,        // booking_com_name to match
  checkInDate: string,
  checkOutDate: string,
  bookingReference: string,
  guestNames: string[],
  triggerSource: "channex" | "manual" | "allocate-unit"
}
```

**Algorithm (BFS shortest-chain-first):**

1. Get all units of the given room type (by `booking_com_name`) excluding `status = 'maintenance'` or `status = 'blocked'`
2. Get all active reservations (`confirmed` or `pending_assignment` status -- never `checked-in`) across those units that overlap with the requested date range
3. Build a graph:
   - For each existing reservation on those units, check which OTHER units of the same type are free for that reservation's date range
   - This creates potential "moves"
4. BFS from depth 1 to depth 4 (max chain length):
   - Depth 1: Can we move one existing booking to another room, freeing up a room for the new booking?
   - Depth 2-4: Chain moves -- move A to free room X, which lets us move B to X's old spot, etc.
5. If a valid chain is found:
   - Execute all moves (update `unit_id` on each reservation, set `skip_channex_sync = true` to avoid triggering OTA sync for internal shuffles)
   - Set `shuffled_from_unit_id`, `shuffled_at`, `shuffle_log_id` on each moved reservation
   - Log the shuffle in `room_shuffle_log`
   - Return the freed unit ID
6. If no valid chain exists, return null (caller handles the conflict)

**Blocked dates check:** Each candidate "move-to" room is also checked against `blocked_dates` for the reservation's date range.

**Output:**
```text
{
  success: boolean,
  freedUnitId?: string,
  freedUnitNumber?: string,
  moves?: MoveDetail[],
  shuffleLogId?: string
}
```

---

### Integration Points

**1. `allocate-unit` edge function (existing)**

After the current "first available" loop fails (line 118), BEFORE creating a pending assignment reservation:
- Call `auto-shuffle-rooms` with the room type and dates
- If shuffle succeeds, return the freed unit as the allocated unit (with `strategy: 'auto_shuffle'`)
- If shuffle fails, fall through to existing pending assignment logic

**2. `channex-booking-webhook` edge function (existing)**

After saving the booking to `channex_bookings`, if the booking needs room allocation:
- The webhook currently doesn't allocate rooms directly (it saves to `channex_bookings` table, not `reservations`)
- The shuffle integration here would be indirect: when a Channex booking is later processed into a reservation (via `allocate-unit`), the shuffle runs there

**3. `CreateReservationDialog` (frontend, manual bookings)**

Manual bookings already require selecting a specific room. The auto-shuffle would only apply if we add an option like "Auto-assign best available room" -- but since the user explicitly picks a room, the shuffle is less relevant here. The existing conflict prevention trigger (`prevent_reservation_overlap`) handles manual conflicts at the DB level.

The primary trigger point is the `allocate-unit` function.

---

### Email Notification

After a successful shuffle, the `allocate-unit` function calls `send-admin-notification` (already exists) with:
- Subject: "Room Shuffle Alert -- ICONIA Zamalek"
- Body listing the triggering booking and each move made
- Uses the existing Resend-based admin email infrastructure

---

### UI Changes

**1. RoomCalendar -- shuffle indicator**

In `src/components/RoomCalendar.tsx`, when rendering a reservation cell:
- Check if `shuffled_at` is set on the reservation
- If so, show a small shuffle icon (Lucide `ArrowLeftRight` or `Shuffle`) overlaid on the booking bar
- Tooltip shows "Auto-shuffled from Room #X on [date]"

**2. New page: Shuffle History (`/shuffle-history`)**

- New page `src/pages/ShuffleHistory.tsx`
- Fetches from `room_shuffle_log` ordered by `shuffle_date DESC`
- Each entry shows:
  - Date/time of shuffle
  - Triggering booking reference and guest name
  - Room type
  - List of moves with from/to room numbers and guest names
- Add link in SlideMenu under PMS section

**3. Reservation detail note**

In `ReservationQuickActions` or reservation detail views:
- If `shuffled_from_unit_id` is set, display a note: "Room changed from #X to #Y by auto-shuffle on [date]"

---

### Technical Details

**Files to create:**
| File | Purpose |
|------|---------|
| `supabase/functions/auto-shuffle-rooms/index.ts` | Core shuffle algorithm edge function |
| `src/pages/ShuffleHistory.tsx` | Admin shuffle history page |

**Files to modify:**
| File | Change |
|------|--------|
| `supabase/functions/allocate-unit/index.ts` | Call auto-shuffle before creating pending assignment |
| `supabase/config.toml` | Add `auto-shuffle-rooms` function config |
| `src/components/RoomCalendar.tsx` | Add shuffle indicator icon on shuffled reservations |
| `src/components/SlideMenu.tsx` | Add Shuffle History link under PMS |
| `src/App.tsx` | Add route for `/shuffle-history` |

**Database migration:**
- Create `room_shuffle_log` table with RLS
- Add `shuffled_from_unit_id`, `shuffled_at`, `shuffle_log_id` columns to `reservations`

**Edge case handling:**
- Concurrent shuffle attempts: The shuffle function uses `FOR UPDATE` row locking on reservations being moved to prevent two simultaneous shuffles from conflicting
- `skip_channex_sync = true` is set on moved reservations to prevent triggering OTA availability pushes for internal room swaps
- Maximum chain depth capped at 4 moves
- Only `confirmed` and `pending_assignment` reservations are candidates for moving (never `checked-in`)

