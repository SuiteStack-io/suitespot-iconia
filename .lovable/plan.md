

## Fix Cash Settlement Page to Show VAT-Inclusive Amounts

### Problem Analysis

The Cash Settlement page is currently displaying the raw `total_price` from the database, which stores the **subtotal WITHOUT VAT**. However, you collect VAT as cash, so the amounts should include the 14% VAT.

| Booking Reference | Price/Night | Nights | Subtotal (DB) | VAT (14%) | Total to Collect |
|-------------------|-------------|--------|---------------|-----------|------------------|
| MAN-1767022959781-1 | $110 | 8 | $880.00 | $123.20 | **$1,003.20** |

The Reservation Details page correctly calculates VAT dynamically: `subtotal + (subtotal * 14%)`.

The Cash Settlement page must do the same calculation.

---

### Technical Changes

#### File: `src/pages/CashSettlement.tsx`

**1. Update Reservation type definition** (around line 33-47)

Add the missing fields needed for VAT calculation:

```typescript
type Reservation = {
  id: string;
  booking_reference: string;
  guest_names: string[];
  check_in_date: string;
  check_out_date: string;
  total_price: number | null;
  price_per_night: number | null;  // NEW
  nights: number | null;           // NEW
  vat_exempt: boolean | null;      // NEW
  payment_method: string | null;
  source: string;
  channel: string;
  settled: string | null;
  status: string;
  unit_id: string | null;
  units?: { 
    name: string; 
    unit_number: string | null; 
    booking_com_name: string | null;
    tax_percentage: number | null;  // NEW
  } | null;
};
```

**2. Update the query to fetch additional fields** (around line 69-79)

Include `tax_percentage` from units:

```typescript
.select('*, units(name, unit_number, booking_com_name, tax_percentage)')
```

**3. Add a helper function to calculate VAT-inclusive total** (after line 260)

```typescript
const calculateTotalWithVAT = (reservation: Reservation): number => {
  if (reservation.vat_exempt) {
    return reservation.total_price || 0;
  }
  const subtotal = (reservation.price_per_night || 0) * (reservation.nights || 0);
  const taxPercentage = reservation.units?.tax_percentage || 14;
  return subtotal + (subtotal * taxPercentage / 100);
};
```

**4. Update all places that sum `total_price`** (multiple locations)

Replace `r.total_price || 0` with `calculateTotalWithVAT(r)` in:

- **Stats calculation** (lines 175-178):
  ```typescript
  const cashTotal = cashReservations.reduce((sum, r) => sum + calculateTotalWithVAT(r), 0);
  const cardTotal = cardReservations.reduce((sum, r) => sum + calculateTotalWithVAT(r), 0);
  const settledTotal = settledReservations.reduce((sum, r) => sum + calculateTotalWithVAT(r), 0);
  const pendingTotal = pendingReservations.reduce((sum, r) => sum + calculateTotalWithVAT(r), 0);
  ```

- **Selected totals calculation** (lines 237-239, 245-248)
- **Table row display** (line 459): Show VAT-inclusive amount
- **Table footer total** (line 372)
- **Export to Excel function** (lines 300-341)
- **Modal data display**

**5. Update column header for clarity** (line 418)

```typescript
<TableHead>Total (incl. VAT)</TableHead>
```

**6. Update table footer text** (around line 524)

```typescript
<TableCell colSpan={hasCheckbox ? 6 : 5} className="text-right font-semibold">
  Total incl. 14% VAT ({data.length} reservations)
</TableCell>
```

---

### Summary of Changes

| Location | Current | After Fix |
|----------|---------|-----------|
| Displayed amount | $880.00 (subtotal) | $1,003.20 (incl. VAT) |
| Column header | "Total Amount" | "Total (incl. VAT)" |
| Stats cards | Raw `total_price` | Calculated with VAT |
| Excel export | Raw `total_price` | Calculated with VAT |

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/CashSettlement.tsx` | Add VAT calculation logic, update query, update all displays |

