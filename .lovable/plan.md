

## Add Companies Table + Missing property_id Columns

### Database Migration

**1. Create `companies` table:**
- id (uuid, PK, default gen_random_uuid())
- name (text, not null)
- logo_url (text, nullable)
- default_currency (text, default 'USD')
- default_timezone (text, default 'Africa/Cairo')
- vat_rate (numeric, default 14)
- created_at, updated_at (timestamptz)
- Enable RLS: admins full access, authenticated users can view their company

**2. Add `company_id` to existing tables:**
- `properties` -- add `company_id uuid references companies(id)`, nullable initially
- `profiles` -- add `company_id uuid references companies(id)`, nullable initially

**3. Add `property_id` to secondary tables missing it:**
- `whatsapp_message_log` -- add `property_id uuid`, nullable, with `set_default_property_id` trigger
- `room_shuffle_log` -- add `property_id uuid`, nullable, with `set_default_property_id` trigger
- `channel_markup_settings` -- add `property_id uuid`, nullable, with `set_default_property_id` trigger
- `derived_rate_plan_mappings` -- add `property_id uuid`, nullable, with `set_default_property_id` trigger

**4. Seed default company + backfill:**
- Insert a "SuiteSpot Hospitality" company record
- Update all existing `properties` rows to reference it
- Update all existing `profiles` rows to reference it
- Backfill `property_id` on the 4 secondary tables using the default property

**5. RLS policies for `companies`:**
- Admins can manage all companies
- Users can SELECT their own company (via profiles.company_id)

### Frontend Changes

**6. Update `PropertyProvider` context (`src/lib/propertyContext.tsx`):**
- Add `company` field to context (fetched from properties → company)
- Extend the `Property` interface with `company_id`

**7. Update `PropertyForm` (`src/components/settings/PropertyForm.tsx`):**
- Add `company_id` field (auto-set to current user's company, hidden from UI for now)

**8. Update query filters on secondary tables:**
- `whatsapp_message_log` queries -- apply `withPropertyFilter`
- `room_shuffle_log` queries -- apply `withPropertyFilter`
- `channel_markup_settings` queries -- apply `withPropertyFilter`
- `derived_rate_plan_mappings` queries -- apply `withPropertyFilter`

### Summary
- 1 migration with all schema changes + seed data
- ~6 files updated for frontend property filtering on newly-scoped tables
- No breaking changes -- all nullable columns with triggers for backward compatibility

