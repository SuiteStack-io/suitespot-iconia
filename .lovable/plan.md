

## Channex Testing and Debug Page

### Overview

A new admin-only page at `/channex-debug` with six test tools for verifying the Channex integration. Each tool shows the full API request and response in formatted JSON panels.

---

### 1. New Edge Function: `supabase/functions/channex-fetch-state/index.ts`

A new backend function that proxies GET requests to Channex for viewing remote state. This is needed because the Channex API key is server-side only.

**Accepts:** `{ property_id: string }` (local property ID)

**Logic:**
1. Authenticate caller (admin check via existing session pattern)
2. Resolve the local property ID to a Channex property ID via `channex_mappings`
3. Fetch in parallel from Channex:
   - `GET /api/v1/properties/{channex_id}`
   - `GET /api/v1/room_types?filter[property_id]={channex_id}`
   - `GET /api/v1/rate_plans?filter[property_id]={channex_id}`
   - `GET /api/v1/availability?filter[property_id]={channex_id}&filter[date][gte]={today}`
4. Return all four responses as a combined JSON object

**Config:** Add `[functions.channex-fetch-state] verify_jwt = false` to `supabase/config.toml`.

---

### 2. New Page: `src/pages/ChannexDebug.tsx`

An admin-only page with all six test sections, each in its own collapsible card. Uses the existing `SlideMenu`, `AdminBreadcrumb`, and `ProtectedRoute` pattern.

**Shared UI pattern for all tests:**
- Each test has a card with inputs/button
- A "Request" panel showing the JSON sent
- A "Response" panel showing the JSON received
- Loading spinner during execution
- Response time display in milliseconds
- Color-coded status (green for success, red for error)

#### Test 1: API Connection
- Single "Test Connection" button
- Calls the existing `channex-health-check` edge function
- Shows response time and full health data

#### Test 2: Manual Property Sync
- Dropdown listing all units from the `units` table (shows name + unit_number)
- "Sync Property" button
- Calls existing `channex-sync-property` edge function
- Shows full request body and response

#### Test 3: Manual Availability Push
- Dropdown for property (units with channex mappings)
- Dropdown for room type (channex_mappings where entity_type = 'room_type')
- Date pickers for date_from and date_to
- Number input for availability count
- Calls existing `channex-push-availability` edge function
- Shows request and response

#### Test 4: Manual Rate Push
- Dropdown for property
- Dropdown for rate plan (channex_mappings where entity_type = 'rate_plan', joined with rate_plans for name)
- Date pickers for date_from and date_to
- Number input for rate amount (in dollars, function converts to cents)
- Calls existing `channex-push-rates` edge function
- Shows request and response

#### Test 5: Simulate Incoming Booking
- "Create Test Booking" button
- Inserts a test record directly into `channex_bookings` table with:
  - `channex_booking_id`: "test-" + random UUID
  - `ota_name`: "Test/Debug"
  - `guest_name`: "Test Guest"
  - `status`: "new"
  - `arrival_date`: tomorrow
  - `departure_date`: tomorrow + 3 days
  - `total_amount`: 100
  - `acknowledged`: false
  - Uses first available property mapping for `property_id`
- Shows the inserted record
- Includes a "Delete Test Bookings" button to clean up (deletes where ota_name = 'Test/Debug')

#### Test 6: View Channex State
- Dropdown to select a property (only those with channex mappings)
- "Fetch State" button
- Calls new `channex-fetch-state` edge function
- Shows four collapsible sections:
  - Property details
  - Room types
  - Rate plans
  - Availability data

---

### 3. Route and Navigation

**`src/App.tsx`:** Add route `/channex-debug` wrapped in `ProtectedRoute`, lazy-import `ChannexDebug` page.

**`src/components/SlideMenu.tsx`:** Add a "Debug" link under the PMS section, visible only to admins, pointing to `/channex-debug`.

---

### Technical Details

**Component structure within ChannexDebug.tsx:**

The page will be a single file with internal helper components:
- `JsonPanel` - Reusable component that renders formatted JSON in a `<pre>` block with a dark background, copy button, and collapsible behavior for large payloads
- `TestCard` - Wrapper card with title, description, action area, and request/response panels
- Each test section as a function within the page component

**Data fetching for dropdowns:**
- Units: `supabase.from('units').select('id, name, unit_number, booking_com_name')`
- Channex mappings: `supabase.from('channex_mappings').select('*').eq('sync_status', 'synced')`
- Rate plans: `supabase.from('rate_plans').select('id, name')`

**Admin-only access:**
- Route wrapped in `ProtectedRoute` (same as all admin routes)
- Edge function checks admin role server-side
- Page checks `userRole === 'admin'` and shows access denied if not

**Files to create:**
- `supabase/functions/channex-fetch-state/index.ts` (new edge function)
- `src/pages/ChannexDebug.tsx` (new page)

**Files to modify:**
- `supabase/config.toml` (add channex-fetch-state config)
- `src/App.tsx` (add route)
- `src/components/SlideMenu.tsx` (add menu item)

