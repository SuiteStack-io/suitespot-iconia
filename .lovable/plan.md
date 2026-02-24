

## Add Guest Stats Cards (Total Guests + Email Coverage)

### Change

**File: `src/pages/Guests.tsx`**

Add two summary cards between the header and the filters section (after line 470, before the `bg-card` div). These cards will use the already-filtered `filteredGuests` data so they automatically reflect the active week/month filter.

### Card 1: Total Guests
- Shows the count of `filteredGuests`
- Label: "Total Guests"

### Card 2: Email Coverage
- Count guests that have an email via `checkInAgreements.get(guest.reservationId)?.guest_email`
- Show count and percentage: e.g. "45 / 60 (75%)"
- Label: "Emails Collected"

### Layout
- Two cards in a responsive grid (`grid grid-cols-2 gap-4 mb-6`)
- Uses the existing `Card`, `CardHeader`, `CardTitle`, `CardContent` components

### Technical Details

| What | How |
|------|-----|
| Total guests | `filteredGuests.length` |
| Emails count | `filteredGuests.filter(g => checkInAgreements.get(g.reservationId)?.guest_email).length` |
| Percentage | `Math.round((emailCount / totalCount) * 100)` or 0 if no guests |
| Placement | After header (line 470), before the filters card |
| Components | Import `Card, CardContent, CardHeader, CardTitle` from `@/components/ui/card` |

Since `filteredGuests` already reflects week/month filters and status filters, the cards will update automatically when any filter changes.

