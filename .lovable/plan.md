

## Fix All Currency Displays to Show USD

### Problem

The Reservation Detail page currently displays pricing using the `reservation.currency` field from the database (e.g., "EGP" for card payments). However, since all room rates are set in USD, the displayed amounts should always show "USD" regardless of the payment currency stored.

---

### Technical Changes

**File: `src/pages/ReservationDetail.tsx`**

Replace all 17 instances of `{reservation.currency}` used for pricing display with a hardcoded `USD`:

| Section | Line(s) | Current | Updated |
|---------|---------|---------|---------|
| WhatsApp share - Subtotal | 821 | `${reservation.currency}` | `USD` |
| WhatsApp share - Taxes | 822 | `${reservation.currency}` | `USD` |
| WhatsApp share - Total | 823 | `${reservation.currency}` | `USD` |
| Email share - Subtotal | 873 | `${reservation.currency}` | `USD` |
| Email share - Taxes | 874 | `${reservation.currency}` | `USD` |
| Email share - Total | 875 | `${reservation.currency}` | `USD` |
| Booking.com pricing - Price/Night | 1521 | `{reservation.currency}` | `USD` |
| Booking.com pricing - Subtotal | 1527 | `{reservation.currency}` | `USD` |
| Booking.com pricing - Total | 1533 | `{reservation.currency}` | `USD` |
| Manual pricing - Price/Night | 1551 | `{reservation.currency}` | `USD` |
| Manual pricing - Subtotal | 1557 | `{reservation.currency}` | `USD` |
| Manual pricing - Taxes | 1564 | `{reservation.currency}` | `USD` |
| Manual pricing - Total | 1571 | `{reservation.currency}` | `USD` |
| Download section - Price/Night | 2147 | `{reservation.currency}` | `USD` |
| Download section - Subtotal | 2153 | `{reservation.currency}` | `USD` |
| Download section - Taxes | 2160 | `{reservation.currency}` | `USD` |
| Download section - Total | 2167 | `{reservation.currency}` | `USD` |

---

### What Remains Unchanged

- **Currency field display** (line 1609): Continues to show the actual stored currency for payment record-keeping purposes
- **Commission Amount** and **Net Revenue** (lines 1588, 1595): Already use `$` prefix
- **ReservationsList table**: Already uses `$` prefix for all amounts

---

### Result

All pricing displays across the page will consistently show USD:
- Price per Night: `USD 82.00`
- Subtotal: `USD 1312.00`
- Taxes & Fees: `USD 183.68`
- Total Price: `USD 1495.68`

The Currency metadata field will still reflect the actual payment currency (EGP, USD, etc.) for administrative records.

---

### File Summary

| File | Action | Changes |
|------|--------|---------|
| `src/pages/ReservationDetail.tsx` | Update 17 currency displays | Lines 821-823, 873-875, 1521-1571, 2147-2167 |

