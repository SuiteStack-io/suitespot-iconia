
Goal: restore ICONIA reservations/calendar visibility and remove the reservation error when operating as an admin user.

What I found
- The data is still in the database:
  - ICONIA property has 281 reservations and 12 units.
- Your current logged-in user is app role `admin`, but only has `user_property_access` for **Test Property**.
- Reservations are protected by property-scoped policies using `user_has_property_access(...)`, which currently does **not** treat app `admin` as globally allowed.
- Result: on ICONIA, reservations queries return `[]` (not an HTTP error), so pages look empty.
- Additional frontend gap: `AvailabilityCalendar.tsx` reservations fetch is not property-filtered, which can cause cross-property inconsistencies once access is fixed.

Implementation plan
1) Backend permission fix (primary root cause)
- Create a migration to update `public.user_has_property_access(...)` so it returns `true` when the user has app role `admin`.
- Keep existing system admin + property-role logic unchanged.

2) Backfill missing access records for existing admin users
- In the same migration, insert missing `(admin_user, property)` rows into `user_property_access` for all existing properties.
- Use `ON CONFLICT (user_id, property_id) DO NOTHING` to avoid duplicates.
- This immediately restores visibility for current admins (including your current account), not only future properties.

3) Frontend query correctness for calendar
- Update `src/components/AvailabilityCalendar.tsx`:
  - Apply `withPropertyFilter(...)` to the reservations query inside `fetchData()`.
- This ensures the unit availability calendar shows only the active property’s bookings and avoids mixed-property behavior.

4) Verification checklist
- Switch to ICONIA and verify:
  - `/admin` cards (arrivals, in-house, etc.) show non-zero values where expected.
  - Unit Availability Calendar shows real bookings (not only empty cells).
  - `/reservations-list` table repopulates with ICONIA rows.
  - “Create Reservation” on ICONIA succeeds without permission error.
- Switch to Test Property and confirm data is isolated by property.

Technical details
- Files to change:
  - `supabase/migrations/<new>.sql`
    - `CREATE OR REPLACE FUNCTION public.user_has_property_access(...)` with admin-role bypass.
    - Backfill SQL for admin-property access rows.
  - `src/components/AvailabilityCalendar.tsx`
    - Add `withPropertyFilter` wrapper to reservations query in `fetchData`.
- No changes needed in:
  - `src/components/ReservationsList.tsx` dependency fix already applied.
  - `src/components/CreateReservationDialog.tsx` property-change refetch already applied.
