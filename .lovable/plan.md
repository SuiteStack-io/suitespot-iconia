

## Consolidate Late Checkout into Single Dialog

### Problem
There are currently **two separate** late checkout buttons in Quick Actions:
1. **"Late Checkout Fee"** → inline mode that creates a linked reservation with $50 fee (failing with error)
2. **"Late Checkout Time"** → opens `LateCheckoutDialog` that sets time + blocks unit

These need to be merged into ONE dialog that does everything.

### Root Cause of Fee Error
The `handleLateCheckout` function (line 645-730 in `ReservationQuickActions.tsx`) creates a new reservation record as a linked fee entry. The error is likely an RLS or trigger issue during this insert. This entire approach will be replaced by the consolidated flow.

### Plan

#### 1. Update `LateCheckoutDialog.tsx` — Add fee section to existing dialog
Expand the existing dialog to include:
- **Time picker** (already exists — 1-8 PM dropdown)
- **Fee section** (new):
  - Editable fee amount input (default $50)
  - Auto-calculated breakdown: Base = fee/1.14, VAT = fee - base, Total
  - "Charge late checkout fee" checkbox (default checked)
  - Attribution line: "Late checkout attributed to: [Guest Name]. This creates a linked reservation. Commission (10%) will be credited to you."
- **Unit block info** (already exists)
- **OTA sync warning** (already exists)
- **Save/Discard buttons** (already exists)

New props: `guestName`, `bookingReference`, `currency`, `currentUserName`, `fullReservation` (for group_id, status, etc.)

#### 2. Update `useLateCheckout.ts` — Add fee creation to apply flow
Extend `applyLateCheckout` to optionally create the linked reservation (fee entry):
- Accept `feeEnabled`, `feeAmount`, `fullReservation`, `currentUserName` params
- After blocking unit + setting time, if fee enabled:
  - Create linked reservation with `-LC` suffix (same logic as current `handleLateCheckout`)
  - Set `skip_channex_sync: true` on the fee reservation to avoid trigger issues
  - Update original reservation's `group_id` if needed
  - Invoke `send-late-checkout-notification`

#### 3. Update `ReservationQuickActions.tsx` — Remove duplicate flows
- **Remove**: `lateCheckoutMode` state and all its inline UI (lines 1812-1890)
- **Remove**: The separate "Late Checkout Fee" button (line 1666-1675)
- **Keep**: The "Late Checkout Time" button but rename to just "Late Checkout"
- **Remove**: `handleLateCheckout` function (line 645-730), `LATE_CHECKOUT_FEE` constant, related state vars (`lateCheckoutMode`, `processingLateCheckout`)
- Pass new props to `LateCheckoutDialog`: guest name, booking ref, currency, user name, full reservation data

#### 4. Update `ReservationDetail.tsx` — Same consolidation
- Pass the same new props to `LateCheckoutDialog` on this page
- Remove any separate late checkout fee UI if present

### Technical Details
- Fee reservation insert will include `skip_channex_sync: true` to prevent channex trigger from firing on a 0-night reservation
- The `property_id` will be explicitly set from `fullReservation.property_id` to avoid RLS issues
- The dialog handles both apply and remove modes (remove only removes time + block, not the fee reservation)

### Files Changed
- `src/components/LateCheckoutDialog.tsx` — major expansion with fee section
- `src/hooks/useLateCheckout.ts` — add fee creation logic
- `src/components/ReservationQuickActions.tsx` — remove duplicate flow, pass new props
- `src/pages/ReservationDetail.tsx` — pass new props to dialog

