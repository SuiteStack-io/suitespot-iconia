

## Analysis

The database already stores the full name **"ICONIA Zamalek - Boutique Stay & Wellness Residences"** in both the `properties` table and `channex_property_config` table. The inconsistency is purely in frontend code.

However, many of the "ICONIA Zamalek" references in the frontend are **public-facing branding** (navigation links, hero headings, page titles, footers) where the short form is intentional for readability. These should NOT be changed — "ICONIA Zamalek" is the brand name shown to guests; the longer name is the operational/system name.

The places that should use the full name are **admin/system contexts** where the property name should match the database record:

### Changes

1. **`src/components/settings/PropertyForm.tsx`** — Update placeholder from `"e.g., ICONIA Zamalek"` to `"e.g., ICONIA Zamalek - Boutique Stay & Wellness Residences"`

2. **`supabase/functions/send-reservation-notification/index.ts`** — Replace all 6 occurrences of `"ICONIA Zamalek"` with `"ICONIA Zamalek - Boutique Stay & Wellness Residences"` in email templates (subject line, body text, footer)

3. **`supabase/functions/send-cancellation-notification/index.ts`** — Replace `"ICONIA Zamalek"` with `"ICONIA Zamalek - Boutique Stay & Wellness Residences"` in cancellation email footer

### Not Changed (Intentional)

The following use the short brand name for public-facing UI and should remain as-is:
- `PublicNav.tsx` — Navigation menu links
- `PublicFooter.tsx` — Footer links  
- `PublicHome.tsx` — Hero heading and buttons
- `About.tsx` — Property card titles and footer links
- `BookingFlow.tsx` — Booking page heading
- `IconiaZamalek.tsx` — Property page
- `LocationsManagement.tsx` — Already uses the full name via `LOCATION_DISPLAY_NAMES` mapping
- `channex/PropertySettings.tsx` — Already uses the full name as placeholder

