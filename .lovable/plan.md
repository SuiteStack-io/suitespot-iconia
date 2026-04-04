

## Fix: Channex Phone Number Prefix + Nationality Code-to-Name Conversion

### Problem 1: Hardcoded "+20" Phone Prefix
**File:** `supabase/functions/send-reservation-notification/index.ts` — Line 617

The staff email template has `+20 ${customerPhone}`, but Channex phones already include the country code. This produces "+20 +201044337222".

**Fix:** Replace `+20 ${customerPhone}` with `${customerPhone}`.

### Problem 2: Nationality Stored as 2-Letter ISO Code
**File:** `supabase/functions/channex-booking-webhook/index.ts` — Lines 459, 560

`guestCountry` from Channex (e.g., "GB") is stored directly in `guest_nationality`. Manual bookings store full names ("United Kingdom"), splitting analytics.

**Fix — 3 parts:**

#### Part A: Convert at the webhook (source)
Add an ISO-to-country-name map in `channex-booking-webhook/index.ts` and apply it to `guestCountry` before inserting/updating reservations. Comprehensive map covering ~100 countries. Fallback: if code not found, store as-is.

#### Part B: Fix existing data via migration
Current 2-letter codes in the database: AT, CA, DE, EG, FR, GB, NL, US (plus one empty string).

Migration SQL:
```sql
UPDATE reservations SET guest_nationality = 'Austria' WHERE guest_nationality = 'AT';
UPDATE reservations SET guest_nationality = 'Canada' WHERE guest_nationality = 'CA';
UPDATE reservations SET guest_nationality = 'Germany' WHERE guest_nationality = 'DE';
UPDATE reservations SET guest_nationality = 'Egypt' WHERE guest_nationality = 'EG';
UPDATE reservations SET guest_nationality = 'France' WHERE guest_nationality = 'FR';
UPDATE reservations SET guest_nationality = 'United Kingdom' WHERE guest_nationality = 'GB';
UPDATE reservations SET guest_nationality = 'Netherlands' WHERE guest_nationality = 'NL';
UPDATE reservations SET guest_nationality = 'United States' WHERE guest_nationality = 'US';
UPDATE reservations SET guest_nationality = NULL WHERE guest_nationality = '';
```

#### Part C: Email nationality display
Once the database stores full names, the email template at line 610 (`${guestNationality}`) will automatically show correctly — no template change needed.

### Files Changed
1. `supabase/functions/send-reservation-notification/index.ts` — Remove "+20 " prefix from phone (line 617)
2. `supabase/functions/channex-booking-webhook/index.ts` — Add ISO→country name conversion before DB insert
3. Database migration — Fix 8 existing 2-letter codes + 1 empty string

### What Does NOT Change
- Manual booking nationality flow (already correct)
- Email template layout/design
- Analytics queries
- Channex webhook logic (other than adding the conversion)

