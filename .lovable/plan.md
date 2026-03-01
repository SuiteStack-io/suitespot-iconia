

## Remove Booking.com ID field from Rate Plan dialog

### Change

**`src/components/pms/RatePlanDialog.tsx`**: Remove the Booking.com ID input field block (the `<div>` containing the label, input, and helper text around lines 178-183).

No other files need changes — the `booking_com_id` state and save logic can stay since the field exists in the database; we're just removing it from the UI.

