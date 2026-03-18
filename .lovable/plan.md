

## Fix: Batch All Channex API Calls in Full Sync

### Problem
The full sync sends separate API calls per room type (availability) and per rate plan (restrictions), plus further splits into batches of 10. A property with 2 room types and 4 rate plans generates 7+ API calls instead of 2.

### Solution
Restructure the function to **collect all values first, then send minimally**:

1. **Availability**: Accumulate all availability values across all room types into one `allAvailValues` array. After the loop, make a single `POST /api/v1/availability` call (or split at 500 entries max per call).

2. **Restrictions/Rates**: Accumulate all rate+restriction values across all rate plans into one `allRateValues` array. After the loop, make a single `POST /api/v1/restrictions` call (or split at 500 entries max per call).

3. **Change `BATCH_SIZE` from 10 to 500**. Remove the 6-second `BATCH_DELAY_MS` between batches (unnecessary when sending 1-2 calls).

### Changes in `supabase/functions/channex-full-sync/index.ts`

**Lines 20-21**: Change `BATCH_SIZE = 500`, remove `BATCH_DELAY_MS`.

**Lines 104-202 (Availability section)**:
- Move `availValues` accumulation outside the per-room-type loop into a shared `allAvailValues` array
- Remove the per-room-type API call block (lines 184-195)
- After the loop ends, send all values in chunks of 500 via one or few API calls

**Lines 226-326 (Rates section)**:
- Move `rateValues` accumulation outside the per-rate-plan loop into a shared `allRateValues` array  
- Remove the per-rate-plan API call block (lines 300-311)
- After the loop ends, send all values in chunks of 500
- Keep the restriction sync marking logic

**Result**: 2 room types + 4 rate plans = exactly 2 API calls (1 availability + 1 restrictions), unless either exceeds 500 entries.

