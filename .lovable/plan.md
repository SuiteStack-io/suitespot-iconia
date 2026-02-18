

## Fix Channex Data Structure: Single Property with Room Types

### Overview

The current implementation incorrectly treats each individual room/unit as a separate Channex "property." This plan restructures everything so there is ONE property ("ICONIA Zamalek") with room types nested underneath it. This involves 5 parts: a new database table, a settings UI, rewritten sync logic, updated property sync UI, and a reset mechanism.

---

### Part 1: Database -- `channex_property_config` Table

Create a new table to store the single property's configuration:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Default `gen_random_uuid()` |
| property_name | text | e.g. "ICONIA Zamalek - Boutique Stay & Wellness Residences" |
| email | text | |
| phone | text | |
| address | text | |
| city | text | e.g. "Cairo" |
| country | text | 2-letter code, e.g. "EG" |
| zip_code | text | |
| timezone | text | e.g. "Africa/Cairo" |
| currency | text | 3-letter code, e.g. "USD" |
| latitude | decimal | |
| longitude | decimal | |
| description | text, nullable | |
| channex_property_id | text, nullable | Filled after first sync |
| created_at | timestamptz | Default `now()` |
| updated_at | timestamptz | Default `now()` |

RLS: Admin-only for all operations, read for authenticated users. An `updated_at` trigger will be attached.

---

### Part 2: Settings Tab on Channex Integration Page

Add a **"Settings"** tab to the existing `/channex` page (alongside Connection, Properties, Logs, Bookings, Alert History).

**Section A: Property Configuration Form**
- Text inputs for: Property Name, Email, Phone, Address, City, Zip Code, Description
- Dropdowns for: Country (common country codes), Timezone (common timezones), Currency (USD, EGP, EUR, GBP)
- Number inputs for: Latitude, Longitude
- If `channex_property_id` is set, display it as read-only with a "Synced" badge
- Save button that upserts the single row in `channex_property_config`

**Section B: Room Type Summary (read-only)**
- Table showing room types grouped by name from the `units` table:

| Room Type | Units | Count | Max Adults | Max Children | Max Infants |
|-----------|-------|-------|------------|--------------|-------------|
| Deluxe Suite | 506, 509, 511, 512, 518 | 5 | 3 | 0 | 0 |
| Suite with Terrace | 501, 502, 505 | 3 | 3 | 0 | 0 |
| Junior Suite | 503, 517 | 2 | 3 | 0 | 0 |
| Double Room with Terrace | 504 | 1 | 3 | 0 | 0 |
| Family Suite | 417/418 | 1 | 5 | 0 | 0 |

- This data is derived from the existing `units` table and the Room Types management page
- Each row links to the Room Types page for editing

New component: `src/components/channex/PropertySettings.tsx`

---

### Part 3: Rewrite `channex-sync-property` Edge Function

The function currently accepts a `property_id` (a unit ID). It will be rewritten to:

1. **Read property config** from `channex_property_config` (single row). If no config exists, return error "Please configure property settings first."

2. **Create/update ONE property in Channex** using the config data. Store the Channex property ID back into `channex_property_config.channex_property_id` and in `channex_mappings` with a new `entity_type = 'property'` using a fixed local_id (the `channex_property_config.id`).

3. **Group units by room type name** (using `booking_com_name` field). For each group:
   - Count the number of units as `count_of_rooms`
   - Use the first unit's ID as the `local_id` for the mapping (consistent with current approach)
   - Create room type in Channex with correct inventory count
   
4. **Create rate plans** for each room type (same logic as before but linked to the single property).

The function will no longer accept `property_id` from the body. Instead it reads the config automatically.

---

### Part 4: Update Property Sync UI

Replace the current `PropertySync` component (which lists individual units as properties) with a simplified view:

- Show the property name from `channex_property_config`
- Display summary: "5 room types, 12 total units"
- Show sync status (synced/not synced) with Channex property ID if synced
- Single "Sync to Channex" button
- If no config exists, show a message: "Please configure your property details in the Settings tab first" with a link/button to switch to the Settings tab

---

### Part 5: Reset/Cleanup Section

Add a "Reset Channex Sync" card at the bottom of the Settings tab:

- Shows count of current `channex_mappings` entries (X properties, Y room types, Z rate plans)
- "Delete All from Channex and Reset" button (with confirmation dialog) that:
  1. Reads all `channex_mappings` entries
  2. Calls Channex DELETE API for each entity (properties, room types, rate plans) -- deleting the property should cascade
  3. Clears all rows from `channex_mappings`
  4. Clears `channex_property_id` from `channex_property_config`
  5. Shows success/error summary

New edge function: `supabase/functions/channex-reset-sync/index.ts`

---

### Part 6: Update Dependent Systems

**Channex Debug page** (`src/pages/ChannexDebug.tsx`):
- Update Test 2 (Manual Property Sync) to remove the unit dropdown and instead show a single "Sync Property" button that calls the updated function
- Update Test 3 (Availability Push) and Test 4 (Rate Push) to work with room type mappings as they do now (these already use mappings correctly)

**Daily sync** (`channex-daily-sync`): No changes needed -- it already reads from `channex_mappings` to find synced properties and room types.

**Process sync queue** (`channex-process-sync-queue`): No changes needed -- it resolves Channex IDs from `channex_mappings` which will be populated correctly.

**Database triggers** (`notify_channex_availability_change`, `notify_channex_blocked_dates_change`, `notify_channex_rate_change`): No changes needed -- they look up room type mappings by `booking_com_name` which remains correct.

---

### Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | Create `channex_property_config` table with RLS |
| `src/components/channex/PropertySettings.tsx` | **New** -- Settings tab with property config form + room type summary + reset section |
| `src/pages/ChannexIntegration.tsx` | **Modify** -- Add "Settings" tab |
| `src/components/channex/PropertySync.tsx` | **Modify** -- Replace unit-level display with single-property view |
| `supabase/functions/channex-sync-property/index.ts` | **Modify** -- Read from `channex_property_config`, create one property |
| `supabase/functions/channex-reset-sync/index.ts` | **New** -- Delete Channex entities and clear mappings |
| `src/pages/ChannexDebug.tsx` | **Modify** -- Update Test 2 to remove unit dropdown |
| `src/App.tsx` | No change needed (no new routes) |

