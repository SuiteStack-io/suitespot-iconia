

## Fix: Extension bookings miscategorized in daily summary email

### Problem
Extension bookings (booking_reference containing "EXT") check in on today's date but the guest is already in the hotel. They incorrectly appear in "Today's Check-ins" instead of "In-House Guests".

### Changes — Single file: `supabase/functions/generate-daily-summary/index.ts`

**1. Filter extensions out of Check-ins query** (lines 249-255)
- After fetching check-ins, add `booking_reference` to the select
- Post-filter results to exclude any booking where `booking_reference` contains "EXT" (case-insensitive)
- Supabase JS doesn't support `NOT ILIKE`, so filter client-side after fetch

**2. Fetch extension bookings checking in today for In-House merging** (after line 272)
- Add a separate query for extension bookings checking in today: `check_in_date = todayStr` AND `booking_reference ILIKE '%EXT%'`
- Also select `booking_reference` to extract the base reference (e.g., `MAN-1769009315400-1` from `MAN-1769009315400-1-EXT2`)

**3. Merge extensions into In-House Guests with deduplication** (lines 274-286)
- Combine regular in-house data with today's extension bookings
- For each guest, find ALL their related bookings (original + extensions) by matching the base booking reference
- Use the LATEST checkout date across all extensions for "Nights Remaining"
- Use the ORIGINAL booking's source (not the extension's source)
- Deduplicate: show each guest only once, keyed by base booking reference
- Logic:
  - Extract base reference: strip `-EXT`, `-EXT2`, `-EXT3` suffix
  - Group all bookings by base reference
  - For each group: take max checkout date, take source from the booking without "EXT" in its reference, take guest name from any entry

**4. Fetch all related bookings for source resolution**
- Query all reservations matching the base references of extension bookings to find the original booking's source
- This ensures the Source column shows "Booking.com" even if the extension was created as "Direct"

### What stays the same
- Check-outs section, occupancy calculation, email design, weekly/monthly summaries
- No database or table changes needed

