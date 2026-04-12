

## Fix 4 UX Issues on Dynamic Pricing Page

### Changes — 1 File: `src/pages/DynamicPricing.tsx`

**Issue 1: Replace auto-save with queued "Save Changes" pattern**

- Remove `saveTimerRef` and `debouncedSaveRules` auto-save function
- Add `pendingRulesChanges` state (`Partial<PricingRules>`) and `pendingBoundsChanges` state (`Record<string, {min_rate, max_rate}>`) to track dirty fields
- All onChange handlers update local `rules`/`rateBounds` state AND merge into pending changes — no DB writes
- Add `beforeunload` listener (same pattern as BulkAvailabilityEditor lines 98-108) when pending changes exist
- Add sticky save bar at top (below breadcrumb) when changes exist: primary Button showing "Save Changes (N)" with change count
- Add `saveStatus`/`saveProgress` state for progress bar (same visual as BulkAvailabilityEditor lines 387-407)
- On save click: animate progress bar, run single `pricing_rules.update()` for rule changes + individual `rate_plan_prices.update()` per modified bound row, then clear pending state and show toast
- Remove per-bound `saveBound` auto-save on blur

**Issue 2: Channex sync button — progress bar + last synced timestamp**

- Add `channexSyncStatus`/`channexSyncProgress`/`channexSyncStep` state (idle/syncing/success/error pattern)
- Show progress bar below the sync button during sync (same HTML structure as BulkAvailabilityEditor)
- Change button text to "Syncing..." and disable during sync
- On success, store timestamp in `localStorage` keyed `dynamic_pricing_last_channex_sync_${propertyId}`
- On mount, read from localStorage and display "Last synced: Apr 12, 2026, 12:30 PM" in muted text below the button
- Format timestamp using `new Date().toLocaleString('en-US', { ... })`

**Issue 3: Monthly revenue targets — comma formatting**

- Add helper `formatWithCommas(n: number): string` that returns locale-formatted number
- For each revenue input, track a `focused` state
- When focused: show raw number for editing
- When blurred: display with commas (e.g. "25,000")
- Store raw numeric value in rules state

**Issue 4: Pace Index Bump Threshold — info dialog**

- Import `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription` from ui/dialog
- Add `paceInfoOpen` boolean state
- Next to the "Pace Index Bump Threshold" label, add clickable `Info` icon (h-4 w-4, text-muted-foreground, cursor-pointer)
- On click, open Dialog with title "What is the Pace Index?" and the specified body text
- "Got it" Button to close

### What Does NOT Change
- Edge Function `channex-update-property-settings`
- Database tables/schema
- SlideMenu, routing
- Any other pages or components

