

## Channex Integration Admin Page

### Overview

Create a new admin page at `/channex` under the PMS section called "Channex Integration". The page will have four tabbed sections for managing the Channex channel manager: Connection Status, Property Sync, Sync Logs, and Recent OTA Bookings.

---

### Files to Create

| File | Description |
|------|-------------|
| `src/pages/ChannexIntegration.tsx` | Main page with tabs layout, header, breadcrumb |
| `src/components/channex/ConnectionStatus.tsx` | Section 1 -- API key check + test connection button |
| `src/components/channex/PropertySync.tsx` | Section 2 -- Property list with sync status and actions |
| `src/components/channex/SyncLogs.tsx` | Section 3 -- Filterable log table with expandable JSON |
| `src/components/channex/RecentBookings.tsx` | Section 4 -- Recent OTA bookings table with expandable details |
| `supabase/functions/channex-test-connection/index.ts` | Edge function to verify API key works |

### Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Add `/channex` route with ProtectedRoute |
| `src/components/SlideMenu.tsx` | Add "Channex Integration" item under PMS section |
| `supabase/config.toml` | Add `[functions.channex-test-connection]` entry |

---

### Page Structure

The page follows the exact same layout pattern as `pms/Prices.tsx`:
- Sticky header with SlideMenu + title
- AdminBreadcrumb with section="PMS", currentPage="Channex Integration"
- Tabs component with four tabs: Connection, Properties, Sync Logs, Bookings

---

### Section 1: Connection Status

A Card displaying:
- Status indicator (green/red badge) based on test result
- Base URL in use (staging vs production)
- "Test Connection" button that invokes the `channex-test-connection` edge function
- Shows last test result with timestamp

The edge function:
1. Reads `CHANNEX_API_KEY` and `CHANNEX_BASE_URL` from env
2. Makes GET request to `/api/v1/properties?limit=1` via `channexRequest`
3. Returns `{ connected: true/false, base_url, error? }`
4. Uses admin auth pattern (validates session + admin role)

---

### Section 2: Property Sync

- Fetches units from `units` table (distinct properties)
- Fetches all `channex_mappings` records
- For each property, shows:
  - Name and unit number
  - Sync status badge: "Not Synced" (gray), "Synced" (green), "Error" (red) -- from `channex_mappings.sync_status`
  - Channex ID if synced
  - Last synced date from `channex_mappings.last_synced_at`
  - "Sync to Channex" button calling `channex-sync-property` via `supabase.functions.invoke`
  - Collapsible "View Details" showing child room_type and rate_plan mappings

---

### Section 3: Sync Logs

- Fetches from `channex_sync_logs` ordered by `created_at` desc (limit 100)
- Table columns: Date, Function, Endpoint, Status (success/error badge), Error Message
- Filter controls:
  - Select for property (from units list)
  - Toggle for success/error filter
- Collapsible rows to show `request_payload` and `response_payload` as formatted JSON

---

### Section 4: Recent OTA Bookings

- Fetches from `channex_bookings` ordered by `created_at` desc (limit 50)
- Table columns: Date, OTA, Guest Name, Arrival, Departure, Status, Acknowledged
- Collapsible rows showing full details: email, phone, country, amount, currency, OTA code, raw booking_data JSON

---

### Navigation

Add "Channex Integration" to the PMS section in SlideMenu using the `Radio` icon from lucide-react. It will appear after "Restrictions" in the PMS group.

### Route

```text
/channex -> ProtectedRoute -> ChannexIntegration
```

---

### Technical Details

**Data fetching**: Each tab component manages its own data fetching with `useState`/`useEffect` and loading states using the `Loader2` spinner pattern.

**Edge function (channex-test-connection)**:
- Admin auth validation (same pattern as channex-push-rates)
- Calls `channexRequest('GET', '/api/v1/properties?limit=1')`
- Returns connection status and base URL
- Config: `verify_jwt = false`

**UI Components used**: Card, Badge, Button, Tabs/TabsList/TabsTrigger/TabsContent, Table components, Collapsible, Loader2, toast (sonner)

**Sync action**: The "Sync to Channex" button calls `supabase.functions.invoke('channex-sync-property', { body: { property_id: unit.id } })` and shows toast feedback.

