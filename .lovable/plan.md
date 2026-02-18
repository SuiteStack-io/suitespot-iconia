

## Enhanced Reset Channex Sync Feature

### Overview
Expand the existing basic reset section in PropertySettings into a comprehensive reset tool with multiple reset levels, a detailed mappings table with individual deletion, and cleanup guidance.

### Current State
- A basic "Reset Channex Sync" card already exists at the bottom of the Settings tab
- An edge function `channex-reset-sync` already handles Channex API deletion and clearing mappings
- Current data: 2 properties, 5 room types, 1 rate plan mapped; 8 sync logs; 0 bookings
- `channex_sync_logs` table is missing a DELETE RLS policy for admins

### Changes

**1. Database Migration**
- Add a DELETE RLS policy on `channex_sync_logs` so admins can clear logs from the client side

**2. Update Edge Function: `channex-reset-sync/index.ts`**
- Accept a `mode` parameter in the request body:
  - `"full"` (default) -- delete from Channex API, clear mappings, clear logs, clear bookings, reset config
  - `"mappings_only"` -- clear mappings only (no Channex API calls, keep logs/bookings)
  - `"logs_only"` -- clear sync logs only
  - `"single"` -- delete a single mapping by ID (accepts `mapping_id` parameter), also deletes from Channex API if it's a property
- Accept optional `include_logs` and `include_bookings` booleans for the `"full"` mode

**3. Expand PropertySettings Reset Section**
Replace the current simple reset card with a comprehensive section containing:

**Part A: Warning Banner**
- Yellow/amber alert at the top with warning icon explaining what reset does

**Part B: Current Sync Status Summary**
- Counts: X properties, X room types, X rate plans, X total
- Sync logs count and bookings count

**Part C: Mappings Table**
- Fetch full `channex_mappings` data (entity_type, local_id, channex_id, last_synced_at, sync_status)
- Display in a table with columns: Entity Type | Local ID (truncated) | Channex ID (truncated) | Status | Last Synced | Actions
- Each row has a trash icon button for individual deletion with confirmation dialog

**Part D: Three Reset Buttons**
1. **"Clear All Sync Data"** (red/destructive) -- calls edge function with mode `"full"`, confirmation dialog with checkboxes for "Also clear sync logs" and "Also clear bookings"
2. **"Clear Property Mappings Only"** (orange/warning via `outline` variant with warning styling) -- calls edge function with mode `"mappings_only"`
3. **"Clear Sync Logs"** (secondary/gray) -- deletes from `channex_sync_logs` directly via client SDK (admin RLS allows it after migration)

**Part E: Channex Cleanup Reminder**
- Info card at the bottom with step-by-step instructions for cleaning up Channex directly
- "Open Channex Dashboard" button linking to `https://staging.channex.io` in a new tab

### Files to Modify/Create

| File | Action |
|------|--------|
| Migration SQL | Add DELETE policy on `channex_sync_logs` for admins |
| `supabase/functions/channex-reset-sync/index.ts` | Add `mode` parameter support (`full`, `mappings_only`, `logs_only`, `single`) |
| `src/components/channex/PropertySettings.tsx` | Expand the reset section with mappings table, multiple buttons, individual delete, and cleanup guide |

