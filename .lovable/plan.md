

## Update Summary Report Sender Email

### Changes
Update the `from` field in all three summary report Edge Functions from `"SuiteSpot Reports <frontdesk@bookings.suitespoteg.com>"` to `"Mia — SuiteSpot AI <ai-assistant@bookings.suitespoteg.com>"`.

**Files to modify:**
| File | Line | Current | New |
|------|------|---------|-----|
| `supabase/functions/generate-daily-summary/index.ts` | 352 | `"SuiteSpot Reports <frontdesk@bookings.suitespoteg.com>"` | `"Mia — SuiteSpot AI <ai-assistant@bookings.suitespoteg.com>"` |
| `supabase/functions/generate-weekly-summary/index.ts` | 257 | `"SuiteSpot Reports <frontdesk@bookings.suitespoteg.com>"` | `"Mia — SuiteSpot AI <ai-assistant@bookings.suitespoteg.com>"` |
| `supabase/functions/generate-monthly-summary/index.ts` | 334 | `"SuiteSpot Reports <frontdesk@bookings.suitespoteg.com>"` | `"Mia — SuiteSpot AI <ai-assistant@bookings.suitespoteg.com>"` |

No other files are affected. Check-in/check-out notification emails remain unchanged.

