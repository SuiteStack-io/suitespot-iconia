

## Fix: OTA Reservations Still Showing on Commissions Page

### Root cause
The previous fix added `.is('channex_booking_id', null)` to the query, but Booking.com reservations created via the **manual screenshot upload flow** (`parse-reservation-screenshot` edge function) do NOT have a `channex_booking_id` — they're inserted directly into `reservations` with `source = "Booking.com"` (or similar). They bypass the Channex filter entirely.

The visible rows (Daphne Dimitria, Gouhier Benoit, etc.) all have `Team Member: booking.com`, confirming they were uploaded as Booking.com screenshots.

### Fix (single file: `src/pages/Commissions.tsx`)

Add OTA source-name exclusions alongside the existing `channex_booking_id` filter in `fetchReservations`. Both filters work together:
- `.is('channex_booking_id', null)` — excludes Channex webhook bookings
- `.not('source', 'ilike', '%booking%')` — excludes manually uploaded Booking.com reservations
- `.not('source', 'ilike', '%airbnb%')` — excludes Airbnb
- `.not('source', 'ilike', '%expedia%')` — excludes Expedia

### Final query

```ts
const { data, error } = await withPropertyFilter(supabase
  .from('reservations')
  .select('id, booking_reference, ... , units!unit_id(name, unit_number, booking_com_name)'), propertyId)
  .is('channex_booking_id', null)
  .not('source', 'ilike', '%booking%')
  .not('source', 'ilike', '%airbnb%')
  .not('source', 'ilike', '%expedia%')
  .not('commission_amount', 'is', null)
  .gt('commission_amount', 0)
  .is('cancelled_at', null)
  .order('check_in_date', { ascending: false });
```

Update the inline comment on line 82 to: `// Fetch manual/direct booking commissions only (excludes Channex bookings AND manually-uploaded OTA reservations by source name)`.

### Why this covers everything on the page
All UI (summary cards, Unpaid/Paid tables, source dropdown, Excel export, bulk mark-as-paid) derives from the same `reservations` state — filtering at the query excludes OTA rows from every downstream surface automatically.

### Future-proofing
- Any new OTA via Channex → auto-excluded by `channex_booking_id` filter.
- Any manually-uploaded Booking.com / Airbnb / Expedia screenshot → auto-excluded by source-name filter.
- New OTAs uploaded manually in the future would need their source pattern added — acceptable trade-off given the small number of OTAs that support screenshot import.

### Out of scope (unchanged)
- Page layout, design, calculation logic for manual bookings
- ReservationsList, Analytics, Dashboard, or any other page
- `commission_amount` / `commission_rate` values stored on existing rows
- Database schema, RLS, edge functions, screenshot parser

### Verification
1. Open `/commissions` for ICONIA Zamalek for April 2026 → all rows with "Team Member: booking.com" disappear (Daphne Dimitria, Gouhier Benoit, etc.).
2. Rows with "Team Member: Others - Nicola" and other manual entries remain.
3. Summary cards recompute to manual-only totals.
4. Source dropdown no longer lists `Booking.com`.
5. Excel export contains no OTA rows.

