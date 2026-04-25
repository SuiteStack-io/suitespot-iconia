## Goal

Add **Russia, Hungary, Cyprus, Croatia** to the phone-code dropdowns across all guest forms, and ensure the same four countries appear in every nationality dropdown.

## Audit results

Most of the work is already done. Confirmed by reading every relevant file:

| File | Nationality list | Phone code list |
|---|---|---|
| `src/pages/BookingFlow.tsx` | ✅ Already has all 4 | ❌ Missing all 4 |
| `src/components/CreateReservationDialog.tsx` | ✅ Already has all 4 | ❌ Missing all 4 |
| `src/pages/ReservationDetail.tsx` | ✅ Already has all 4 | (no phone input) |
| `src/pages/GuestCheckIn.tsx` | uses `COUNTRY_CODES` (so missing 4) | ❌ Missing all 4 |
| `supabase/functions/channex-booking-webhook/index.ts` | ✅ ISO→name map already has RU/HU/CY/HR | n/a |

So Booking.com webhook already correctly converts `RU` → `Russia` etc. — no edge function change needed.

## Changes

Add the following four entries to the `COUNTRY_CODES` array in **three files**, each at the correct numerical position to keep the existing ascending-by-dialing-code order:

- `+7  RU 🇷🇺 Russia`     → after `+1 CA` (before `+20 EG`)
- `+36 HU 🇭🇺 Hungary`    → after `+34 ES` (before `+39 IT`)
- `+357 CY 🇨🇾 Cyprus`    → after `+356` slot (in the +35x cluster, before `+358 FI`)
- `+385 HR 🇭🇷 Croatia`   → after `+380 UA` (before `+420 CZ`)

Files to edit:

1. **`src/pages/GuestCheckIn.tsx`** — lines 42–132. Adds the 4 phone codes; this also adds Russia/Hungary/Cyprus/Croatia to the nationality dropdown because that dropdown iterates over `COUNTRY_CODES` (line 505).
2. **`src/components/CreateReservationDialog.tsx`** — lines 70–160. Phone code list only (nationality list is separate and already complete).
3. **`src/pages/BookingFlow.tsx`** — lines 53–97. Phone code list only (nationality list is separate and already complete). Note: this file's `COUNTRY_CODES` is shorter and stops at `+971`; the new entries still slot in by numerical order.

No other files require changes:
- ISO→country mapping in the Channex webhook already contains RU/HU/CY/HR.
- `RevenueByGuests.tsx` only references `countryCode` as a prop name, not a list.
- No other nationality or country-code arrays exist in the codebase.

## Out of scope

- No reordering of existing entries.
- No validation/logic changes.
- No edge function changes (mapping is already correct).
