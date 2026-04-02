

## Fix Inconsistent Channex Property ID Across PMS

### Root Cause
Three separate sources store the Channex Property ID:
1. `channex_mappings` table (correct: `6b4e4f35-...`) — authoritative
2. `properties.channex_property_id` column — was just synced in previous fix
3. `channex_property_config.channex_property_id` column — **still has the old value** (`67a25d0e-...`)

The **Settings tab** reads from `channex_property_config` (source #3), which was never updated.

### Changes

**1. Database: Update stale value in `channex_property_config`**
```sql
UPDATE channex_property_config
SET channex_property_id = '6b4e4f35-6287-46ae-a588-a220484b05f6';
```

**2. UI: Settings tab reads from `channex_mappings` instead**
**File: `src/components/channex/PropertySettings.tsx`**

- The `channex_property_id` displayed at lines 267-276 currently comes from `config.channex_property_id` (the `channex_property_config` table)
- Change the "Synced" badge and displayed ID to use the property mapping from `channex_mappings` (already fetched at line 107 into `mappings` state)
- Derive the property mapping: `const propertyMapping = mappings.find(m => m.entity_type === 'property');`
- Replace `config.channex_property_id` references in the display/badge (lines 267, 273, 275) with `propertyMapping?.channex_id`
- Keep the reset handlers that clear `channex_property_id` on the config table (lines 182, 203) — they're fine for cleanup

**3. Edge function: `channex-create-derived-rate-plan`**
**File: `supabase/functions/channex-create-derived-rate-plan/index.ts`**

- Lines 167-170 read `channex_property_id` from `channex_property_config` — change to read from `channex_mappings` where `entity_type = 'property'`

### Summary
- 1 data update (insert tool)
- 2 file edits (`PropertySettings.tsx`, `channex-create-derived-rate-plan/index.ts`)
- All other edge functions already use `channex_mappings` for property ID resolution

