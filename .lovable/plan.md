

## Add VAT to the Edit-Mode Pricing Recalculation

Currently, `recalculatePricing` calculates `totalPrice` as the raw sum of nightly rates (subtotal) without adding VAT. The view-mode display already shows VAT correctly (14% tax). The edit mode needs the same treatment.

### Changes in `src/pages/ReservationDetail.tsx`

**1. Update `recalculatePricing` (lines 454-492) to include VAT**

After summing nightly rates into `totalPrice` (which is actually the subtotal):
- Fetch `tax_percentage` from the unit (default 14%) and check `vat_exempt` from formData
- Calculate `taxAmount = isVatExempt ? 0 : subtotal * (taxPercentage / 100)`
- Set `total_price = subtotal + taxAmount`
- Update the breakdown string to include the tax line, e.g.:
  `"5 weekday nights × USD 100.00 + 2 weekend nights × USD 120.00 = USD 740.00 + 14% VAT USD 103.60 = USD 843.60"`
- Derive `price_per_night` from the subtotal (pre-tax) divided by nights, since that's the nightly rate

**2. Update the edit-mode Total Price display (line 1452-1459)**

- Rename the label to "Total Price (incl. VAT)" to match the view-mode display
- Add a "Subtotal" and "Taxes & Fees" line between Price per Night and Total Price, matching the view-mode layout:
  - Subtotal = subtotal (nightly rates sum), stored in new state `priceSubtotal`
  - Taxes & Fees row (shown only if not VAT exempt)
  - Total Price (incl. VAT) as the final read-only field

**3. Add state for subtotal tracking**

Add `priceSubtotal` state variable to hold the pre-tax sum so the edit-mode UI can display the breakdown rows.

**4. Update `handleSave`**

Ensure the saved `total_price` is the VAT-inclusive amount (already the case after step 1).

