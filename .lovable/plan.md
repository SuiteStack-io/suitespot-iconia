

## Replace Hardcoded Email/Phone/Brand Values in Edge Functions with Per-Property Settings

### Overview
Create a shared `property-settings.ts` helper that reads per-property contact and branding fields from the `properties` table. Refactor 17 Edge Functions to use this helper instead of hardcoded `suitespoteg.com` email aliases, hardcoded phone numbers, and "SuiteSpot" brand strings. Update the existing `property-utils.ts` fallback to be operator-neutral.

---

### 1. New Shared Helper — `supabase/functions/_shared/property-settings.ts`

```typescript
export interface PropertySettings {
  property_name: string;
  from_name: string;
  from_email_reservations: string;
  from_email_frontdesk: string;
  from_email_notifications: string;
  from_email_housekeeping: string;
  from_email_ai: string;
  support_email: string;
  support_phone: string;
  support_whatsapp: string;
  wifi_network: string;
  wifi_password: string;
  vat_rate: number;
  default_commission_rate: number;
  // Channex / address fields needed by channex-create-property
  address: string;
  city: string;
  zip_code: string;
  country: string;
  phone: string;
  email: string;
  timezone: string;
  currency: string;
  latitude: number | null;
  longitude: number | null;
}

export async function getPropertySettings(
  supabase: any,
  propertyId: string | null
): Promise<PropertySettings>
```

**Behavior**
- Single query against `properties` selecting all needed columns
- Generic fallbacks (no SuiteSpot branding):
  - `from_email_*` → `'notifications@hostbase.io'`
  - `from_name` → property name (or `'Your Property'`)
  - `support_email`, `support_phone`, `support_whatsapp`, `wifi_*` → `''`
  - `vat_rate` → `0`
  - `default_commission_rate` → `10`
  - `timezone` → `'UTC'`, `currency` → `'USD'`, `country` → `'EG'`
- Returns the fallback object if `propertyId` is null or query fails (logs error, never throws)

### 2. Update `supabase/functions/_shared/property-utils.ts`
- Change fallback from `'SuiteSpot'` to `'Your Property'`

### 3. Edge Function Refactors — Pattern

For each function below, immediately after `propertyId` is resolved (typically after fetching the reservation/booking), call:
```typescript
const settings = await getPropertySettings(supabaseAdmin, propertyId);
```
Then replace hardcoded `from:` strings using template literals.

| # | File | Hardcoded → Replacement |
|---|---|---|
| 1 | `send-reservation-notification/index.ts` (lines 164, 270, 536) | `from:` → `${settings.from_name} Reservations <${settings.from_email_reservations}>`; body `youssef@…` → `settings.support_email`; body `+201003901516` → `settings.support_phone` |
| 2 | `send-cancellation-notification/index.ts` (310) | `from:` → `${settings.from_name} Reservations <${settings.from_email_reservations}>` |
| 3 | `send-modification-notification/index.ts` (326) | same pattern |
| 4 | `send-room-change-notification/index.ts` (287) | same pattern |
| 5 | `send-checkin-notification/index.ts` (162) | `from:` → `${settings.from_name} Front Desk <${settings.from_email_frontdesk}>` |
| 6 | `send-checkout-notification/index.ts` (174) | same pattern |
| 7 | `send-extension-notification/index.ts` (118) | `from:` → `${settings.from_name} <${settings.from_email_notifications}>` |
| 8 | `send-late-checkout-notification/index.ts` (110) | same pattern |
| 9 | `send-admin-notification/index.ts` (132) | same pattern |
| 10 | `send-message-notification/index.ts` (173) | `${propertyName} Inbox <${settings.from_email_notifications}>` |
| 11 | `send-mid-stay-cleaning-notifications/index.ts` (239) | `${settings.from_name} Housekeeping <${settings.from_email_housekeeping}>` |
| 12 | `send-kyc-reminder/index.ts` (33) | `<${settings.from_email_notifications}>` |
| 13 | `send-kyc-completion-notification/index.ts` (113) | same pattern |
| 14 | `auto-shuffle-rooms/index.ts` (672) | `${settings.from_name} Front Desk <${settings.from_email_frontdesk}>` |
| 15 | `auto-assign-rooms/index.ts` (468) | `${settings.from_name} <${settings.from_email_notifications}>` |
| 16 | `generate-weekly-summary/index.ts` (410) | `${settings.from_name} AI Assistant <${settings.from_email_ai}>` |
| 17 | `generate-monthly-summary/index.ts` (517) | same pattern |

### 4. `channex-create-property/index.ts` Special Case

Remove constants:
```diff
- const PROPERTY_EMAIL = 'youssef@suitespotegypt.com';
- const PROPERTY_PHONE = '+201288444086';
- const PROPERTY_ZIP_CODE = '11211';
```
Use the property's own values from `getPropertySettings(supabaseAdmin, property_id)`:
- `email` → `settings.support_email || settings.from_email_reservations`
- `phone` → `settings.support_phone || settings.phone` (use `properties.phone` column too)
- `zip_code` → `settings.zip_code` (from `properties.zip_code`)
- `timezone` → `settings.timezone` (replaces hardcoded `'Africa/Cairo'`)
- `currency` → `settings.currency` (already from property; keep)
- `address`, `city`, `country` → from settings
- Keep validation: if any required field is empty, return 400 with clear message asking the operator to complete property settings first

### 5. KYC Functions — Additional Adjustments

`send-kyc-completion-notification` and `send-kyc-reminder` currently don't accept `propertyId`. Both already accept a `propertyName` arg in their request body. Add optional `propertyId` to the request payload (callers can be updated later); when provided, use it to fetch settings; when missing, fall back to a query that resolves the property by name OR uses the generic fallback. **No caller changes required in this prompt** — fallbacks ensure existing calls keep working.

### 6. Out of Scope (Unchanged)
- Email template HTML/design
- Recipient filtering logic (admin/manager/front_desk arrays already fixed)
- Notification trigger points
- Frontend / `properties` schema (already done)
- Edge function `verify_jwt` settings or `config.toml`

### Files Modified
1. **New**: `supabase/functions/_shared/property-settings.ts`
2. **Updated**: `supabase/functions/_shared/property-utils.ts` (fallback string)
3. **Updated**: 17 edge functions listed above

