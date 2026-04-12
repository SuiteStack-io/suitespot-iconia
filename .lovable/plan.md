

## Build Dynamic Pricing Settings Page

### Overview
Create a new admin page at `/dynamic-pricing` for configuring the per-property pricing algorithm, plus an Edge Function to sync rate bounds to Channex.

### Changes

**1. New file: `src/pages/DynamicPricing.tsx`**
- Full settings page with SlideMenu, AdminBreadcrumb
- Uses `usePropertyId()` to scope to active property
- Loads/creates `pricing_rules` row on mount
- Sections A–G as specified: master toggle, rate guardrails table, Channex sync button, day-of-week multipliers, revenue targets, last-minute strategy radio, collapsible advanced tiers
- Auto-save on blur with 500ms debounce via `setTimeout`
- Rate bounds table: queries `rate_plan_prices` joined with `rate_plans` grouped by `room_type`, editable `min_rate`/`max_rate` inputs with inline validation
- Channex sync button calls the new Edge Function

**2. New file: `supabase/functions/channex-update-property-settings/index.ts`**
- POST endpoint, same auth pattern as `channex-push-rates` (Bearer token + admin role check)
- Accepts `{ property_id, min_price, max_price }`
- Looks up Channex property ID from `channex_mappings`
- PUTs to Channex API `/api/v1/properties/:id` with `{ property: { settings: { min_price, max_price } } }` in cents
- Logs to `channex_sync_logs`
- Returns success/error with CORS headers

**3. Edit: `src/App.tsx`**
- Import `DynamicPricing` from `./pages/DynamicPricing`
- Add route: `<Route path="/dynamic-pricing" element={<ProtectedRoute><AdminRoute><DynamicPricing /></AdminRoute></ProtectedRoute>} />`

**4. Edit: `src/components/SlideMenu.tsx`**
- Import `TrendingUp` from lucide-react
- Add menu item `{ title: 'Dynamic Pricing', url: '/dynamic-pricing', icon: TrendingUp, showFor: ['admin'] }` after "Room Rates" in OPERATIONS section

### What Does NOT Change
- RoomRates.tsx, Analytics.tsx, any existing Edge Functions
- rate_plans, rate_plan_restrictions tables
- Channex sync logic, any other pages/components

