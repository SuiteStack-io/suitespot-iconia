

## Replace Email Column with Guest Form Email

The email column in the Guests table currently shows `reservation.contact_email`. This change will make the check-in agreement (guest form) email the source of truth instead.

### Changes

**File: `src/pages/Guests.tsx`**

1. **Update `contactEmail` population** (line ~129): Instead of using `reservation.contact_email`, look up the check-in agreement email from the `checkInAgreements` map. Since agreements are fetched asynchronously, also re-derive the guest records when agreements load.

2. **Approach**: Rather than changing the data flow, use the already-fetched `checkInAgreements` map at render time:
   - In the table cell (line ~671): Replace `guest.contactEmail` with the agreement email: `checkInAgreements.get(guest.reservationId)?.guest_email || "-"`
   - In the CSV export (line ~354): Same replacement -- use agreement email instead of `guest.contactEmail`
   - Update the table header label from "Email" to "Form Email" to clarify the source

3. **Remove `contactEmail` from `GuestRecord`**: Since it's no longer used, remove it from the interface and the record construction to keep things clean.

### Technical Details

| Location | Current | New |
|----------|---------|-----|
| Line ~41 | `contactEmail: string \| null;` | Remove field |
| Line ~129 | `contactEmail: reservation.contact_email,` | Remove line |
| Line ~354 (CSV) | `guest.contactEmail \|\| "-"` | `checkInAgreements.get(guest.reservationId)?.guest_email \|\| "-"` |
| Line ~671 (table) | `guest.contactEmail \|\| "-"` | `checkInAgreements.get(guest.reservationId)?.guest_email \|\| "-"` |
| Table header | "Email" | "Form Email" |

