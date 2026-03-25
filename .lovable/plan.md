

## Auto-fill Price/Night and Add Discount Button to Extend Stay Form

### What changes

**`src/components/ReservationQuickActions.tsx`** — all changes in this single file:

#### 1. New state variables
- `originalRate: number | null` — stores the calculated default rate for reset functionality
- `isDiscounted: boolean` — tracks whether the -10% discount is active

#### 2. Auto-fill logic when entering extend mode
When `setExtendMode(true)` is clicked (line ~1584), calculate and pre-fill `extensionPricePerNight`:

- **Booking.com source** (`reservation.source` contains "booking"): `fullReservation.total_price / nights` (gross rate per night, since Booking.com totals include commissions)
- **Manual/Direct source**: Use `fullReservation.price_per_night` if available, otherwise `fullReservation.total_price / nights`
- **Extension of extension** (booking ref contains "EXT"): Use the current extension's own `total_price / nights` (already handled in "Extend Again" but needs to apply for first extend too)
- Store this calculated value in `originalRate` for the reset button

#### 3. Add "-10% Discount" button and "Reset" link
Next to the Price/Night input field (both in first-extend and extend-again sections):
- Small button labeled "-10%" styled with a green/blue accent
- On click: sets `extensionPricePerNight` to `originalRate * 0.9`, sets `isDiscounted = true`
- "Reset" link appears when discounted, restores `originalRate`
- Clicking -10% multiple times always applies 10% off the ORIGINAL rate (not compounding)

#### 4. Dynamic helper text replacing "No minimum price applies for extensions"
- **Booking.com**: `"Based on Booking.com rate: $XX.XX/night"` or `"Booking.com rate: $XX.XX → Discounted: $YY.YY (-10%)"` when discounted
- **Direct/Manual**: `"Based on original booking rate: $XX.XX/night"` or with discount suffix
- **Extend Again**: Keep existing floor-based helper text but also show the auto-filled context

#### 5. What stays unchanged
- New Checkout Date field, Currency, Payment Method, Source selectors
- Extension save logic, booking reference generation, commission calculation
- Extend Again price floor validation logic

### Technical details

The auto-fill runs at the moment the user clicks "Extend Stay" (onClick handler at line ~1584). The `fullReservation` data is already fetched at that point. For the "Extend Again" flow, the existing pre-fill logic (lines 1217-1225) already calculates from the first extension — we add `originalRate` tracking and discount button there too.

The `-10%` button uses `Math.round(originalRate * 0.9 * 100) / 100` to avoid floating point issues. The Input remains editable — manual typing clears the discount state.

