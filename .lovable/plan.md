

## Guard Rate Recalculation to Manual Reservations Only

### Problem
`recalculatePricing` fires for ALL reservations in edit mode — including Channex/OTA bookings whose pricing comes from the channel and should not be overwritten by local rate plans.

### Fix — `src/pages/ReservationDetail.tsx`

**1. Skip recalculation for Channex reservations**

At the top of `recalculatePricing` (line 421), add a guard:

```typescript
if (!isEditMode || !formData.unit_id) return;
// ADD: skip for Channex/OTA reservations — their pricing is set by the channel
if (reservation?.channex_booking_id) return;
```

This ensures only manual/direct reservations get rate-plan-based recalculation.

**2. Keep price fields read-only for Channex reservations in edit mode**

The Price per Night, Subtotal, Taxes, and Total Price fields are already read-only display divs. No change needed there — they'll just show the existing DB values without recalculating.

**3. Optionally show a note for Channex reservations**

Below the price breakdown area, show a small info message when editing a Channex reservation:
```tsx
{reservation?.channex_booking_id && isEditMode && (
  <p className="text-xs text-muted-foreground mt-1">
    Pricing is managed by the booking channel and cannot be recalculated.
  </p>
)}
```

### Summary
- One guard condition added to `recalculatePricing`
- One informational message in the edit-mode UI
- No changes to save logic (it already uses `formData.total_price` as-is)

