

## Replace Hardcoded `Africa/Cairo` with Per-Property Timezone

### 1. Frontend — Dashboard timestamps
**`src/components/Dashboard.tsx`** (lines 1101, 1109, 1117)

Add at the top of the component:
```ts
import { useProperty } from '@/lib/propertyContext';
// inside component:
const { activeProperty } = useProperty();
const tz = activeProperty?.timezone || 'UTC';
```
Replace all three `timeZone: 'Africa/Cairo'` with `timeZone: tz`.

### 2. Edge functions — use the reservation's property timezone
Both functions already fetch `settings = await getPropertySettings(supabase, propertyId)` (which exposes `settings.timezone`).

- **`supabase/functions/send-checkin-notification/index.ts`** (line 142): replace `timeZone: 'Africa/Cairo'` with `timeZone: settings.timezone || 'UTC'`.
- **`supabase/functions/send-checkout-notification/index.ts`** (line 154): same change.

### 3. Channex sync — fallback timezone
- **`supabase/functions/channex-sync-property/index.ts`** (lines 117, 144): change `property.timezone || 'Africa/Cairo'` and `propertyConfig.timezone || 'Africa/Cairo'` → fallback `'UTC'`.
- **`supabase/functions/channex-create-property/index.ts`**: already uses `settings.timezone || 'UTC'` (line 198) — no change needed. (The user's reference to "line 204" appears to predate the earlier per-property settings refactor.)

### 4. Frontend property forms — default for new properties
- **`src/components/settings/PropertyForm.tsx`**
  - Line 70: `timezone: property?.timezone || 'Africa/Cairo'` → `'UTC'`.
  - Keep `TIMEZONES` list (line 23) unchanged — selectable options remain.
- **`src/components/channex/PropertySettings.tsx`**
  - Line 80: `timezone: 'Africa/Cairo'` → `'UTC'` in initial `useState`.
  - Keep `TIMEZONES` list (lines 31–35) unchanged.

### 5. Front-desk RoomRates weekend default
- **`src/pages/front-desk/RoomRates.tsx`** (line 71): change `weekend_days` fallback from `[4, 5]` (Fri/Sat) to `[0, 6]` (Sun/Sat).

### Out of scope (unchanged)
- `TIMEZONES` selectable lists in both forms.
- Region presets in `PricingRulesEditor.tsx`.
- `'en-US'` locale strings.
- Database default `'Africa/Cairo'` in historical migrations (not migrated retroactively; existing rows keep current values, new rows still get DB default unless the form sends an explicit value — which it now does via `'UTC'`).
- The `companies.default_timezone` seed value (separate concern; not requested).

### Verification
1. ICONIA Zamalek (timezone `Africa/Cairo`) → Dashboard timestamps and check-in/out emails render in Cairo time exactly as before.
2. New property created without choosing a timezone → defaults to `UTC`; Dashboard and emails render in UTC for that property.
3. Property with `timezone = 'Europe/London'` → all timestamps shift to London time.
4. Front-desk RoomRates page for a property without `weekend_days` set → weekend highlighting falls on Sat/Sun instead of Fri/Sat.

