

## Full Sync (500 days) for Channex Certification

### Overview
Add a per-property "Full Sync" button that pushes 500 days of availability, rates, and restrictions to Channex and returns task IDs needed for certification.

### Implementation

**1. Create `supabase/functions/channex-full-sync/index.ts`**
- Accepts `{ propertyId }` in request body
- Reuses the same logic as `channex-daily-sync` but scoped to a single property
- Key difference: captures and returns Channex API response task IDs from each POST call
- Returns a structured result with `availability_task_ids` and `rates_task_ids` arrays, plus counts of room types and rate plans pushed
- Uses the shared `channex-client.ts` for API calls but also captures raw responses for task IDs
- Logs results to `channex_sync_logs`

**2. Update `src/components/channex/PropertySync.tsx`**
- Add a "Full Sync (500 days)" button to each synced property card (next to existing Sync/Refresh buttons)
- Add state for `fullSyncingPropertyId` and `fullSyncResult`
- On click, invoke `channex-full-sync` with the property ID
- On success, show a Dialog with:
  - Availability pushed count (room types x 500 days)
  - Availability task IDs with copy buttons
  - Rates & restrictions pushed count (rate plans x 500 days)
  - Rates task IDs with copy buttons
  - Note to save IDs for certification

**3. Files**
- New: `supabase/functions/channex-full-sync/index.ts`
- Edit: `src/components/channex/PropertySync.tsx`
- No database changes needed

