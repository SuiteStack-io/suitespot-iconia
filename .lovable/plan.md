

## Add Per-Property Configurable Email, Contact, WiFi & Business Settings

### 1. Database Migration

Add 13 nullable columns to `properties` table:

```sql
ALTER TABLE public.properties
  ADD COLUMN from_email_reservations text,
  ADD COLUMN from_email_frontdesk text,
  ADD COLUMN from_email_notifications text,
  ADD COLUMN from_email_housekeeping text,
  ADD COLUMN from_email_ai text,
  ADD COLUMN from_name text,
  ADD COLUMN support_email text,
  ADD COLUMN support_phone text,
  ADD COLUMN support_whatsapp text,
  ADD COLUMN wifi_network text,
  ADD COLUMN wifi_password text,
  ADD COLUMN vat_rate numeric DEFAULT 14,
  ADD COLUMN default_commission_rate numeric DEFAULT 10;
```

Then backfill existing ICONIA Zamalek property with current SuiteSpot values via the data-update tool (separate operation since this is data, not schema).

### 2. PropertyForm UI — New Step / Section

`src/components/settings/PropertyForm.tsx` is a multi-step dialog (Basic Info → Operations → Success). Add a new **Step 3: Email & Business Settings** for both create and edit flows, pushing Success to Step 4 (and `totalSteps` becomes 4 for create, 3 for edit).

The new step will be a single scrollable form grouped into 4 collapsible sections:

**Email Addresses** (5 inputs + display name)
- Reservations Email, Front Desk Email, Notifications Email, Housekeeping Email, AI Assistant Email
- Display Name (`from_name`)

**Contact Information** (3 inputs)
- Support Email, Support Phone (PhoneInput), WhatsApp Number (PhoneInput)

**Guest WiFi** (2 inputs)
- WiFi Network Name, WiFi Password

**Business Settings** (2 numeric inputs with `%` suffix)
- VAT Rate, Default Commission Rate

All fields optional (placeholders show defaults). Form state, payload mapping, and save logic extended to include the 13 new fields. Step indicator bar updated to reflect new step count.

### 3. Property Type Update

The `Property` type in `src/lib/propertyContext.tsx` will pick up the new columns automatically via the regenerated `types.ts` after the migration runs — no manual edit needed (existing form uses `(property as any)?.field` fallbacks for new fields, same pattern will be used).

### Files Modified
1. **Migration** — add 13 columns
2. **Data update** — backfill ICONIA Zamalek values
3. **`src/components/settings/PropertyForm.tsx`** — add new step with all 4 sections, extend form state and save payload

### What Does NOT Change
- No Edge Function changes (next prompt)
- No email template changes
- No existing property fields modified
- `PropertyList.tsx` unchanged (edit button already opens `PropertyForm`)

