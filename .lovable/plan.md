

## Plan: Fix Pricing Display on Reservation Detail Page

### Problem Analysis
The Reservation Detail page displays `total_price` directly from the database, which for some reservations (created before the VAT fix) contains incorrect values. The reference image shows the **correct** calculation:

| Field | Current Display | Correct Value |
|-------|-----------------|---------------|
| Price per Night | USD 110.00 | USD 110.00 |
| Subtotal (8 nights) | Not shown | USD 880.00 |
| Taxes & Fees (14%) | Not shown | USD 123.20 |
| **Total Price** | **USD 880.00** ❌ | **USD 1003.20** ✓ |

### Root Cause
1. The confirmation download already calculates pricing correctly on-the-fly (lines 2058-2091)
2. The detail page view shows raw `reservation.total_price` from database (line 1498)
3. Some reservations have incorrect `total_price` stored (without VAT)

### Solution
Update the ReservationDetail page to calculate and display pricing the same way the confirmation does - using `price_per_night × nights + VAT` rather than the stored `total_price`. This ensures consistency with the confirmation and matches the reference image format.

---

### Technical Changes

#### File: `src/pages/ReservationDetail.tsx`

**Step 1: Add pricing calculation logic (before the JSX return, around line 1455)**

```typescript
// Calculate pricing breakdown for display
const calculatePricingBreakdown = () => {
  const pricePerNight = reservation?.price_per_night || 0;
  const nights = reservation?.nights || 0;
  const subtotal = pricePerNight * nights;
  const taxPercentage = reservation?.units?.tax_percentage || 14;
  
  // Check if VAT exempt
  const isVatExempt = reservation?.vat_exempt === true;
  const taxAmount = isVatExempt ? 0 : subtotal * (taxPercentage / 100);
  const totalWithTax = subtotal + taxAmount;
  
  return {
    pricePerNight,
    nights,
    subtotal,
    taxPercentage: isVatExempt ? 0 : taxPercentage,
    taxAmount,
    totalWithTax,
    isVatExempt
  };
};

const pricing = reservation ? calculatePricingBreakdown() : null;
```

**Step 2: Update the Pricing display section (lines ~1489-1500)**

Replace the current pricing display with:

```jsx
<div>
  <Label className="text-muted-foreground">Price per Night</Label>
  <p className="mt-1 font-medium">
    {reservation.currency} {pricing?.pricePerNight?.toFixed(2) || 'N/A'}
  </p>
</div>
<div>
  <Label className="text-muted-foreground">Subtotal ({pricing?.nights} nights)</Label>
  <p className="mt-1 font-medium">
    {reservation.currency} {pricing?.subtotal?.toFixed(2)}
  </p>
</div>
{!pricing?.isVatExempt && pricing?.taxPercentage > 0 && (
  <div>
    <Label className="text-muted-foreground">Taxes & Fees ({pricing?.taxPercentage}%)</Label>
    <p className="mt-1 font-medium">
      {reservation.currency} {pricing?.taxAmount?.toFixed(2)}
    </p>
  </div>
)}
<div>
  <Label className="text-muted-foreground font-semibold">Total Price</Label>
  <p className="mt-1 font-bold text-lg">
    {reservation.currency} {pricing?.totalWithTax?.toFixed(2)}
  </p>
</div>
```

---

### Expected Result

After this fix, the Reservation Detail page will show:

| Field | Display Value |
|-------|---------------|
| Price per Night | USD 110.00 |
| Subtotal (8 nights) | USD 880.00 |
| Taxes & Fees (14%) | USD 123.20 |
| **Total Price** | **USD 1003.20** |

This matches the confirmation image format exactly.

---

### Additional Considerations

1. **VAT Exempt Reservations**: The fix respects the `vat_exempt` flag - if true, no VAT will be shown
2. **Booking.com Reservations**: These already include VAT from source, but recalculating ensures consistency
3. **Edit Mode**: The edit mode pricing inputs should remain unchanged (for admins to override if needed)
4. **Commission Calculation**: Commission is already calculated on net revenue, so this display change doesn't affect commissions

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/ReservationDetail.tsx` | Add pricing calculation logic, update pricing display section to show subtotal + VAT + total |

