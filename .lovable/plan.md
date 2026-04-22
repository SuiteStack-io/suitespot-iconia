

## Hide OTA (Channex) Reservations from Commissions Page

### Problem
The Commissions Management page currently shows BookingCom reservations (visible in the screenshot). OTAs deduct their commission before paying out — there is no commission for the PMS to track or settle on these bookings.

### Root cause
The query in `src/pages/Commissions.tsx` (`fetchReservations`, lines 83–90) filters out a hardcoded list of source strings (`"booking.com"`, `"direct website"`, `"Booking.com"`), but OTA bookings created by the Channex webhook arrive with `source = "Channex"` or the OTA name (`"BookingCom"`, `"Airbnb"`, etc.) — none of which match that list. So they pass through.

### Fix (single file: `src/pages/Commissions.tsx`)

Replace the brittle source-string blocklist on line 86 with a single reliable filter:

```ts
.is('channex_booking_id', null)
```

Final query becomes:

```ts
const { data, error } = await withPropertyFilter(supabase
  .from('reservations')
  .select('id, booking_reference, ... , units!unit_id(name, unit_number, booking_com_name)'), propertyId)
  .is('channex_booking_id', null)          // ← only manual / direct bookings
  .not('commission_amount', 'is', null)
  .gt('commission_amount', 0)
  .is('cancelled_at', null)
  .order('check_in_date', { ascending: false });
```

Update the inline comment on line 82 to read: `// Fetch manual/direct booking commissions only (excludes all Channex/OTA reservations)`.

### Why this covers everything on the page

All downstream UI — summary cards (Unpaid / Paid / Total), the Unpaid and Paid tables, the source dropdown, and the "Export to Excel" handler — derive from the same `reservations` state. Filtering at the source query automatically excludes OTA rows from:

- Summary card totals
- Unpaid / Paid tables
- Source filter dropdown options
- Excel export
- Bulk "mark as paid" selection

No other code paths need to change.

### Future-proofing
Any new OTA connected via Channex (Expedia, Agoda, VRBO, etc.) will be auto-excluded because every Channex-sourced reservation carries a `channex_booking_id`, set by the `channex-booking-webhook` and the `sync-channex-to-reservations` backfill function.

### Out of scope (unchanged)
- Page layout, design, calculation logic for manual bookings
- ReservationsList, Analytics, Dashboard, or any other page that intentionally shows OTA bookings
- `commission_amount` / `commission_rate` values stored on existing rows
- Database schema, RLS, edge functions

### Verification
1. Open `/commissions` for ICONIA Zamalek for April 2026 → BookingCom rows in the screenshot disappear.
2. Summary cards recompute to manual-bookings-only totals.
3. The "Source" dropdown no longer lists `BookingCom` / `Channex`.
4. Export to Excel produces a file with no OTA rows.
5. Manual bookings (`source` = `Manual`, `Direct`, `Walk-in`, etc.) continue to appear and behave exactly as before.

