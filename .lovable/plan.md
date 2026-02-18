

## Add Download Confirmation Button to Extension Quick Actions

### What This Does
Adds a "Confirmation" download button next to the existing "Edit Total" and "Remove" buttons in the extension management view. Clicking it downloads a PNG confirmation image for the extension reservation only, using the exact same template as the normal reservation confirmation.

### UI Layout Change

The current two-button row:
`[ Edit Total ] [ Remove ]`

Becomes a three-button row:
`[ Confirmation ] [ Edit Total ] [ Remove ]`

The "Confirmation" button will have a download icon, matching the style shown in the reference screenshot.

### Technical Changes

**File: `src/components/ReservationQuickActions.tsx`**

1. **Add imports**: `toPng` from `html-to-image`, `useRef`, `Download` icon from lucide-react
2. **Add state**: `downloadingExtensionConfirmation` boolean
3. **Fetch extension unit details**: When the component detects an extension reservation, fetch the unit data (name, unit_number, booking_com_name, tax_percentage) so the confirmation template has room info
4. **Add download handler**: `handleDownloadExtensionConfirmation` -- captures the hidden confirmation card as PNG and triggers download
5. **Add hidden confirmation card**: Render a hidden div (positioned offscreen) with the exact same confirmation template from `ReservationDetail.tsx`:
   - Header: SuiteSpot / ICONIA Zamalek / Reservation Confirmation
   - Booking Reference (the -EXT reference)
   - Guest Details (name, number of guests, nationality)
   - Accommodation (room name, unit number)
   - Stay Dates (extension check-in, check-out, duration)
   - Pricing Summary (price per night, subtotal, taxes, total)
   - Contact Information (email, phone)
   - Status badge
   - Footer with generation date
6. **Add button**: Insert a "Confirmation" button with download icon in the button row, before "Edit Total"

### Data Needed
The extension reservation data (`fullReservation`) already has guest_names, check_in_date, check_out_date, price_per_night, nights, total_price, contact_email, contact_phone, status, and booking_reference. The unit details (name, unit_number) will be fetched via a join query when the extension is detected.

