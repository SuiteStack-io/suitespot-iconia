
## Plan: Lock Payment/Currency/Settled Fields for Booking.com Reservations

### Problem Summary
Currently, all reservations in the Reservations List show editable dropdowns for Payment Method, Currency, and Settled status - even for Booking.com reservations. The user wants:

1. **Booking.com reservations** to have these fields **locked** with pre-set values:
   - Payment Method: `credit_card` (shown as "Credit Card")
   - Currency: `USD`
   - Settled: `booking_com` (shown as "Booking.com")

2. **Manual/Direct reservations** should keep these fields **editable**

Note: The sync function (`sync-booking-gmail`) already correctly sets `payment_method: 'booking_com'`, `settled: 'booking_com'`, and `currency: 'USD'` for new Booking.com reservations. The issue is only in the UI display and editability.

---

### Technical Changes

#### File: `src/components/ReservationsList.tsx`

**1. Create helper function to detect Booking.com reservations (after line 768)**

```tsx
const isBookingComReservation = (reservation: Reservation): boolean => {
  return reservation.source?.toLowerCase().includes('booking') || false;
};
```

**2. Modify Payment Method column (lines 1371-1385)**

Change from editable Select to conditional rendering:
- For Booking.com: Display static text "Credit Card" (disabled appearance)
- For Manual: Keep existing editable Select

**3. Modify Currency column (lines 1386-1401)**

Change from editable Select to conditional rendering:
- For Booking.com: Display static text "Dollars (USD)" (disabled appearance)
- For Manual: Keep existing editable Select

**4. Modify Settled column (lines 1402-1416)**

Change from editable Select to conditional rendering:
- For Booking.com: Display static text "Booking.com" (disabled appearance)
- For Manual: Keep existing editable Select

---

#### File: `src/pages/ReservationDetail.tsx`

**5. Modify edit mode for Payment Method (lines 1455-1466)**

When in edit mode for Booking.com reservations:
- Hide or disable the Payment Method dropdown
- Show static read-only value instead

**6. Modify edit mode for Currency (lines 1443-1454)**

When in edit mode for Booking.com reservations:
- Hide or disable the Currency dropdown
- Show static read-only value instead

---

### Implementation Details

**In ReservationsList.tsx - Payment Method column:**

```tsx
<TableCell onClick={(e) => e.stopPropagation()}>
  {isBookingComReservation(reservation) ? (
    <span className="text-sm text-muted-foreground px-2 py-1 bg-muted rounded">
      Credit Card
    </span>
  ) : (
    <Select
      value={reservation.payment_method || ''}
      onValueChange={(value) => handlePaymentMethodChange(reservation.id, value)}
    >
      <SelectTrigger className="w-[110px] h-8 text-xs">
        <SelectValue placeholder="Select..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="cash">Cash</SelectItem>
        <SelectItem value="credit_card">Credit Card</SelectItem>
        <SelectItem value="booking_com">Booking.com</SelectItem>
      </SelectContent>
    </Select>
  )}
</TableCell>
```

**In ReservationsList.tsx - Currency column:**

```tsx
<TableCell onClick={(e) => e.stopPropagation()}>
  {isBookingComReservation(reservation) ? (
    <span className="text-sm text-muted-foreground px-2 py-1 bg-muted rounded">
      Dollars (USD)
    </span>
  ) : (
    <Select
      value={reservation.currency || ''}
      onValueChange={(value) => handleCurrencyChange(reservation.id, value)}
    >
      {/* existing options */}
    </Select>
  )}
</TableCell>
```

**In ReservationsList.tsx - Settled column:**

```tsx
<TableCell onClick={(e) => e.stopPropagation()}>
  {isBookingComReservation(reservation) ? (
    <span className="text-sm text-muted-foreground px-2 py-1 bg-muted rounded">
      Booking.com
    </span>
  ) : (
    <Select
      value={reservation.settled || ''}
      onValueChange={(value) => handleSettledChange(reservation.id, value)}
    >
      {/* existing options */}
    </Select>
  )}
</TableCell>
```

---

### Files to Modify

| File | Lines | Changes |
|------|-------|---------|
| `src/components/ReservationsList.tsx` | ~768, 1371-1416 | Add helper function; conditionally render static text vs editable Select for Payment/Currency/Settled columns |
| `src/pages/ReservationDetail.tsx` | 1443-1466 | Disable or hide Payment Method and Currency dropdowns in edit mode for Booking.com reservations |

---

### Expected Result

**Reservations List - Booking.com reservations will show:**
- Payment: "Credit Card" (non-editable, muted styling)
- Currency: "Dollars (USD)" (non-editable, muted styling)
- Settled: "Booking.com" (non-editable, muted styling)

**Reservations List - Manual reservations will show:**
- Payment: Editable dropdown (Cash, Credit Card, Booking.com)
- Currency: Editable dropdown (USD, AED, SAR, EGP)
- Settled: Editable dropdown (Booking.com, Yes, No)

**Reservation Detail Page - Booking.com reservations:**
- Payment Method and Currency fields will be non-editable in edit mode

---

### Additional Note

Existing Booking.com reservations that may have incorrect values (e.g., empty Payment or Currency) will still display the locked UI with the correct fixed values ("Credit Card", "USD", "Booking.com") based on the source detection, ensuring visual consistency even if the database values differ.
