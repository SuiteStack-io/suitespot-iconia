

## Fix: Tighten Fallback Matching to Prevent False Matches

### Problem
For NEW bookings (status != "cancelled"), the webhook uses fuzzy fallback matching (Try 2: guest name + dates + source) which can match the WRONG reservation when a guest has multiple bookings with overlapping check-in dates but different check-out dates. This caused reservation BDC-5835903406 to be overwritten by BDC-6226916261.

### Root Cause
Lines 400-402: For non-cancelled bookings, `findReservationByFallback` is called unconditionally. The fuzzy match matched on check-in date + guest name even though check-out dates differed (the query already requires exact check-out match, but the real issue is that for NEW bookings, fuzzy matching should never be used at all).

Additionally, line 400 calls fallback for ALL non-cancelled statuses including "new" — new bookings should always create a new reservation if Try 1 (booking_reference) doesn't match.

### Plan

#### 1. Split fallback into two functions
**File**: `supabase/functions/channex-booking-webhook/index.ts`

Replace `findReservationByFallback` with two variants:
- **`findReservationByReference`** — Try 1 only (booking_reference match). Used for new bookings.
- **`findReservationByFallback`** — Try 1 + stricter Try 2. Used only for cancellations and modifications.

Stricter Try 2 rules:
- Require exact match on `check_in_date` AND `check_out_date` (already done)
- If multiple results returned, return `null` (do NOT pick one)
- Remove the `data.length === 1` single-result fallback (too loose)
- Add `channex_booking_id` column to the select, and add safeguard: if matched reservation already has a DIFFERENT `channex_booking_id`, return `null`

#### 2. Update new booking logic (lines 393-402)
For non-cancelled bookings:
- First check direct `channex_booking_id` match (existing, unchanged)
- If no direct match: call `findReservationByReference` (Try 1 only — booking_reference match)
- If reference match found AND it already has a different `channex_booking_id` set, skip it — create new reservation instead
- Do NOT use fuzzy matching for new bookings

#### 3. Update cancellation logic (lines 315-326)
Keep using full `findReservationByFallback` (Try 1 + strict Try 2), but with the stricter rules above.

#### 4. Add channex_booking_id safeguard
In both cancellation and modification paths, before updating a fallback-matched reservation:
- Check if the matched reservation already has a `channex_booking_id` that is different from the current `booking_id`
- If so, do NOT update it — treat as no match (create new for new bookings, send alert for cancellations)

### Specific Code Changes

**`findReservationByFallback` (lines 10-61)**: 
- Add `channex_booking_id` to select queries
- Remove the `data.length === 1` fallback (line 53-56)
- Add check: if matched reservation has a different `channex_booking_id`, skip it
- Accept a `mode` parameter: `"strict"` (cancellations/modifications) or `"reference_only"` (new bookings)

**Lines 393-402** (new booking path):
- Change to only use reference matching for the fallback, not fuzzy
- Add channex_booking_id conflict check before updating

**Lines 324-326** (cancellation path):
- Keep full fallback but benefits from stricter Try 2

### Summary
- 1 file edited (`channex-booking-webhook/index.ts`)
- Fuzzy matching disabled for new bookings
- Fuzzy matching tightened for cancellations (no single-result fallback, channex_booking_id conflict check)
- Prevents false matches when same guest has multiple bookings
- Note: The overwritten reservation (659a79a3) data cannot be restored from code — it needs manual correction in the database based on the original BDC-5835903406 booking data

