

## Add Nights and Nationality columns to Check-ins table in daily summary email

### Changes — Single file: `supabase/functions/generate-daily-summary/index.ts`

**1. Update check-ins query to include additional fields** (line 252)
- Add `check_in_date`, `check_out_date`, and `guest_nationality` to the select statement

**2. Update check-in rows HTML generation** (lines 131-133)
- Calculate nights: `(check_out_date - check_in_date)` in days
- Add Nights and Nationality columns to each row
- Update the empty-state colspan from 3 to 5

**3. Update check-ins table header** (line 167)
- Add `<th>Nights</th>` and `<th>Nationality</th>` after Source

### Note on PDF
The daily summary does not include a PDF attachment (excluded for Edge Function stability per project convention), so no PDF changes are needed.

### What stays the same
- In-House Guests table (already has these columns)
- Check-outs table
- Weekly/monthly summaries
- Email design and header

