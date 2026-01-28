

## Plan: Fix VAT Display for Booking.com Reservations

### Problem Summary
The reservation details page is incorrectly displaying pricing for Booking.com reservations. The code recalculates and adds 14% VAT on top of the `total_price`, but for Booking.com bookings, the total price in the database ($414) **already includes VAT**. This results in an inflated total being displayed ($471.96 instead of $414).

**What Booking.com provides:**
- Total Price: US$414 (VAT-inclusive)
- Commission: US$63.94
- Net Revenue should be: $414 - $63.94 = $350.06

**What the admin currently shows:**
- Subtotal: USD 414.00
- Taxes & Fees (14%): USD 57.96 (incorrectly added)
- Total Price: USD 471.96 (wrong!)

---

### Solution
For Booking.com reservations, the system should:
1. Display the `total_price` from the database directly (already VAT-inclusive)
2. NOT add any additional taxes on top
3. Show net revenue as: `total_price - commission_amount`

For direct/manual reservations, the current calculation (adding VAT) should remain.

---

### Technical Changes

#### File: `src/pages/ReservationDetail.tsx`

**Modify the pricing breakdown logic (lines 1490-1530)**

Currently, the code always calculates tax on top of subtotal:
```tsx
const subtotal = pricePerNight * nights;
const taxAmount = isVatExempt ? 0 : subtotal * (taxPercentage / 100);
const totalWithTax = subtotal + taxAmount;
```

**Change to detect Booking.com source and skip recalculation:**

```tsx
// For Booking.com: total_price is already VAT-inclusive, don't add tax
const isBookingCom = reservation?.source?.toLowerCase().includes('booking') || 
                     reservation?.channel === 'Booking.com';

if (isBookingCom) {
  // Booking.com prices are already VAT-inclusive
  // Display the database total_price directly
  const totalPrice = reservation?.total_price || 0;
  
  return (
    <>
      <div>
        <Label>Price per Night</Label>
        <p>{currency} {pricePerNight.toFixed(2)}</p>
      </div>
      <div>
        <Label>Subtotal ({nights} nights)</Label>
        <p>{currency} {(pricePerNight * nights).toFixed(2)}</p>
      </div>
      <div>
        <Label>Total Price (incl. VAT)</Label>
        <p>{currency} {totalPrice.toFixed(2)}</p>
      </div>
    </>
  );
} else {
  // Manual/Direct reservations: calculate VAT breakdown
  // ... existing VAT calculation logic ...
}
```

---

### Files to Modify

| File | Lines | Changes |
|------|-------|---------|
| `src/pages/ReservationDetail.tsx` | 1490-1530 | Add Booking.com detection; skip VAT recalculation for Booking.com reservations |

---

### Expected Result

**Booking.com reservations will show:**
- Price per Night: USD 103.50
- Subtotal (4 nights): USD 414.00
- Total Price (incl. VAT): USD 414.00 ← Uses database value directly
- Commission Amount: $63.94
- Net Revenue: $350.06 (414 - 63.94)

**Direct/Manual reservations will continue to show:**
- Subtotal + Taxes & Fees (14%) breakdown
- Total Price calculated with VAT

---

### Additional Notes

The database already stores the correct values:
- `total_price`: 414 (VAT-inclusive from Booking.com)
- `commission_amount`: 63.94
- `net_revenue`: 360 (may need correction to 350.06)

This fix ensures the UI matches what Booking.com reports and prevents confusion for admin users.

