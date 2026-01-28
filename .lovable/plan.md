

## Plan: Fix Net Revenue Calculation

### Problem
The Net Revenue is currently reading from the database field `reservation.net_revenue` which contains an incorrect value ($360.00). It should be **calculated** as:

**Net Revenue = Total Price - Commission Amount**
**$414.00 - $63.94 = $350.06**

---

### Technical Changes

#### File: `src/pages/ReservationDetail.tsx`

**Modify lines 1579-1584**

Change from:
```tsx
<div>
  <Label className="text-muted-foreground">Net Revenue</Label>
  <p className="mt-1 font-medium">
    ${reservation.net_revenue ? Number(reservation.net_revenue).toFixed(1) : 'N/A'}
  </p>
</div>
```

Change to:
```tsx
<div>
  <Label className="text-muted-foreground">Net Revenue</Label>
  <p className="mt-1 font-medium">
    {reservation.total_price && reservation.commission_amount
      ? `$${(Number(reservation.total_price) - Number(reservation.commission_amount)).toFixed(2)}`
      : 'N/A'}
  </p>
</div>
```

---

### Files to Modify

| File | Lines | Changes |
|------|-------|---------|
| `src/pages/ReservationDetail.tsx` | 1579-1584 | Calculate net revenue as `total_price - commission_amount` instead of reading from database |

---

### Expected Result

For this Booking.com reservation:
- Total Price: $414.00
- Commission: $63.94
- **Net Revenue: $350.06** (calculated, not from database)

