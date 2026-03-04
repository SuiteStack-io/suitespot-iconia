

## Fix Dual Save Buttons — Separate DB Save from Channex Sync

### Current State
- **Modal "Save Changes"**: Persists rate plan + prices to the database. Also creates derived rate plans via Channex for new plans. No direct rate sync call.
- **Main "Save Changes"**: Calls `syncRatesToChannex()` which invokes `channex-sync-rates` edge function.
- The confusion is both buttons say "Save Changes" and the modal's derived plan creation hits Channex unnecessarily on every edit.

### Approach
The modal must still persist to the database (rate plans need DB IDs for Channex mapping lookups). But it should NOT trigger any Channex API calls. The main button becomes the sole Channex sync trigger with a pending changes counter.

### Changes to `src/pages/pms/Prices.tsx`

1. **Add pending changes state**: `pendingRatePlanIds` (Set of rate plan IDs modified since last sync)
2. **`handleSave` (modal callback)**:
   - Still persists to DB (insert/update rate_plans + rate_plan_prices)
   - Remove the auto-create derived plans loop (or defer it to main save)
   - Add the saved plan ID to `pendingRatePlanIds`
   - Show info toast: "Changes saved locally. Click Save Changes to sync to channels."
3. **Main "Save Changes" button**:
   - Show count badge: `Save Changes (3)`
   - Disabled when `pendingRatePlanIds.size === 0`
   - `syncRatesToChannex()` filters to only pending plan IDs, then clears the set on success
4. **Visual feedback**: Rate plan rows with pending changes get a yellow "Modified" badge
5. **beforeunload warning** when pending changes exist

### Changes to `src/components/pms/RatePlanDialog.tsx`

1. Change button text from `"Save Changes"` / `"Create Rate Plan"` to `"Confirm"` / `"Create"`

### Files
- `src/pages/pms/Prices.tsx` — pending state, modified handleSave, updated sync button
- `src/components/pms/RatePlanDialog.tsx` — button text change

