

## Two-Step Save Flow for Bulk Restriction Editor

### What's changing
Replace the current "Apply → immediate API call" behavior with a two-step flow:
1. **"Apply Restrictions"** adds to a local pending list (no DB write, no Channex call)
2. **"Save Changes"** button saves all pending items to DB and syncs to Channex in one batch

### File: `src/components/pms/BulkRestrictionEditor.tsx`

**New state and types:**
- Add `PendingRestriction` interface with id, ratePlanId, ratePlanName, roomTypeName, dateFrom, dateTo, restrictions object, addedAt
- Add `pendingRestrictions` state array and `isSaving` boolean
- Rename existing `pendingCount` to `pendingDbCount` (to distinguish from local pending)
- Add `beforeunload` listener that warns when `pendingRestrictions.length > 0`

**Modified `handleApply`:**
- Remove `async`, no DB insert, no `setTimeout` Channex call
- Instead: validate, build restriction object from enabled fields, map target plans to `PendingRestriction[]`, append to `pendingRestrictions`
- Call `resetForm()` to clear the form for the next entry
- Show toast: "X restriction(s) added to pending changes"

**New `resetForm` function:**
- Clears dateFrom, dateTo, all enable flags, and resets values to defaults

**New `handleRemovePending(id)`:**
- Filters out one pending item by id

**New `handleSaveAllChanges`:**
- Builds DB rows from all pending items (same shape as current `handleApply` insert)
- Single `supabase.from('rate_plan_restrictions').insert(rows)`
- Then one `channex-push-restrictions` call with all unique rate plan IDs
- On success: clear `pendingRestrictions`, call `fetchSyncStatus()` and `onSaved()`
- If only one unique rate plan affected, call `onRatePlanFocused`

**New UI section — Pending Changes panel (between editor card and sync status card):**
- Only renders when `pendingRestrictions.length > 0`
- Card header: "Pending Changes" title + "Save Changes (N)" button with Save icon
- Each pending item rendered as a row with:
  - Rate plan name + room type
  - Date range
  - Badges for each restriction (Min Stay Arrival: X, Stop Sell, etc.)
  - X button to remove individual item

**Import additions:** `Badge`, `X`, `Save` from lucide-react

### No changes to `Restrictions.tsx` or database schema

