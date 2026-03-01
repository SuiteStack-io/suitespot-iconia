

## Analysis

The Settings page already has a `PropertyList` component with full CRUD: card list, Add Property button, Edit dialog, Delete dialog, Manage Users, and Set Default. The `PropertyForm` is a single-step dialog. The request asks for enhancements to what already exists.

### What needs to change

#### 1. Enhance PropertyList cards
- Add room count per property (query `units` table grouped by `property_id`)
- Already shows: name, city/country, active/inactive badge, Channex sync status

#### 2. Convert PropertyForm to multi-step wizard
Replace the single-scroll dialog with a 3-step flow:
- **Step 1 - Basic Info**: Property name, type, address, city, country, timezone, currency (remove email as required -- make it optional or move to step 2)
- **Step 2 - Operations**: Check-in/out times, VAT rate (need to add VAT field -- but `properties` table doesn't have a `vat_rate` column; the company does. We can skip this or note it pulls from company default)
- **Step 3 - Done**: Success message with "Set Up Rooms" button (navigates to `/room-types` after switching to the new property) and "Do This Later" button (navigates to `/admin`)

The form returns a `createdPropertyId` on success so step 3 can link correctly.

#### 3. Add active/inactive toggle
- Replace delete with a deactivate toggle for properties that have bookings
- Add an `is_active` toggle (the column already exists on `properties`)
- Check for existing reservations before allowing delete; if reservations exist, only allow deactivation
- Non-admin users see the list but no action buttons

#### 4. Filter inactive properties from PropertySwitcher
- Update `PropertySwitcher` to hide inactive properties

#### 5. No database changes needed
- `properties` table already has `is_active`, `property_type`, all address fields, timezone, currency, check-in/out times
- Room count can be fetched with a separate query

### Files to modify

1. **`src/components/settings/PropertyForm.tsx`** -- Rewrite as multi-step wizard (3 steps) with navigation buttons (Next/Back/Create). Step 3 shows success with navigation options.

2. **`src/components/settings/PropertyList.tsx`** -- Add room count display per property card. Add active/inactive toggle button. Check for reservations before allowing delete (show deactivate instead). Hide action buttons for non-admin users.

3. **`src/components/PropertySwitcher.tsx`** -- Filter out inactive properties from the dropdown list.

### Technical details

- Room counts: query `select property_id, count(*) from units group by property_id` once and map to cards
- Deactivation: `update properties set is_active = false where id = ?`
- Reservation check before delete: `select count(*) from reservations where property_id = ?`
- Multi-step form state: single `useState` for step number (1-3), same form state object, conditional rendering per step
- Step 3 success: after insert returns the new property ID, switch to it via `setActiveProperty`, then navigate

