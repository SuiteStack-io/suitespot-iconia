

## Fix Corrupted Reservations — 4 SQL Data Operations

### Current State (2 records exist)
| ID | Current Guest | Current Ref | Current Unit | Current Channex ID |
|---|---|---|---|---|
| `659a79a3` | Malaknaz Barazesh | 5388507785 | Family Suite 417/418 (`b8485d0a`) | `90fdd28b...` |
| `72a4d5b5` | Rojin Sepanj Khoui | 6226916261 | Junior Suite 517 (`d95e7cbc`) | `c9153441...` |

### Operations

#### 1. UPDATE `659a79a3` → Restore to Anne Laure Decom
- guest_names: `{"Anne Laure Decom"}`
- booking_reference: `5388507785` (unchanged)
- dates: Apr 23–27 (unchanged), unit: Family Suite 417/418 (unchanged)
- total_price: 500.40, price_per_night: 125.10, commission_amount: 88.87, commission_rate: 17.76, net_revenue: 411.53
- channex_booking_id: NULL (pre-connection booking)
- adults: 2, children: 2, number_of_guests: 4
- skip_channex_sync: true

#### 2. UPDATE `72a4d5b5` → Restore Rojin with correct ref + move to Deluxe Suite
- booking_reference: `6656841094` (was incorrectly 6226916261)
- unit_id: `1ee439fb` (Deluxe Suite 511, move from Junior Suite 517)
- total_price: 283.75 (unchanged), price_per_night: 141.88, commission_amount: 43.82, commission_rate: 15.44, net_revenue: 239.93
- channex_booking_id: `c9153441...` (unchanged)
- skip_channex_sync: true

#### 3. INSERT — Malaknaz Booking 1 (ref 5835903406, Apr 23–27)
- Junior Suite 517 (`d95e7cbc`, freed by moving Rojin)
- total_price: 446.41, price_per_night: 111.60
- channex_booking_id: `90fdd28b-6fe4-475f-a754-1e3ec483512a`
- property_id: `c98a2256...`, status: confirmed, source: Booking.com

#### 4. INSERT — Malaknaz Booking 2 (ref 6226916261, Apr 23–25)
- Junior Suite 503 (`860c5c76`, now free)
- total_price: 265.31, price_per_night: 132.66, commission_amount: 40.97, commission_rate: 15.44, net_revenue: 224.34
- channex_booking_id: `c266ae07-10d2-47a6-aff5-9320051df5c3`
- property_id: `c98a2256...`, status: confirmed, source: Booking.com

#### 5. Push availability to Channex
Invoke `channex-full-sync` for the property to recalculate availability for all affected room types (Family Suite, Junior Suite, Deluxe Suite).

### Summary
- 2 UPDATEs + 2 INSERTs via the insert tool (no migration needed)
- 1 edge function invocation for availability sync
- No code file changes

