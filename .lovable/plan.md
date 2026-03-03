

## Quick Rate Editor — Integrated into Existing Prices Page

### Changes

#### 1. Increase sync delay: 3s → 30s
**File: `supabase/functions/channex-process-sync-queue/index.ts`** (line 33)
- Change `setTimeout(r, 3000)` → `setTimeout(r, 30000)`

#### 2. Add Quick Rate Editor tab to existing Prices page
**File: `src/pages/pms/Prices.tsx`**
- Add a tab switcher at the top: **Rate Plans** (current view) | **Quick Editor** (new calendar grid)
- The "Rate Plans" tab keeps all existing content unchanged
- The "Quick Editor" tab renders a new `<QuickRateGrid>` component

#### 3. New component: `src/components/pms/QuickRateGrid.tsx`

Calendar-style grid with:

**Header bar:**
- Pending changes count badge + countdown ("Syncing in Xs...")
- "Sync Now" button — saves all pending changes to DB immediately
- "Bulk Edit" button — opens dialog for mass rate updates

**Filters:** Room type dropdown, rate plan dropdown (default: All)

**Date navigation:** `◀ Nov 21 – Nov 27, 2026 ▶` with prev/next week arrows

**Grid table:**
- Rows: each room type + rate plan combination
- Columns: 7 dates with day-of-week labels
- Cells: show effective rate (weekday or weekend based on day)
- Click cell → inline `<input type="number">`, value pre-selected
- Tab moves to next cell, Enter saves + moves down, Escape cancels
- Changed cells get yellow background until synced

**Pending changes panel** at bottom:
- Lists all unsaved changes with old → new values
- "Clear All" and "Sync Now" buttons

**Bulk Edit dialog:**
- Room type selector, rate plan selector, date range, new rate
- Preview count: "This will update X dates × Y plans = Z changes"
- Apply updates all matching cells in pending state

**Sync logic:**
- First change starts a 30-second countdown
- At 0 or on "Sync Now": batch-upsert all changed `rate_plan_prices` rows to DB
- DB triggers fire → sync queue populated → edge function processes after its own 30s delay
- Ctrl+S keyboard shortcut triggers immediate sync

**Mobile:** Below 768px, show a day-by-day list view instead of the grid

#### 4. Nav link update
**File: `src/components/SlideMenu.tsx`**
- No change needed — existing "Prices" link at `/pms/prices` already points to this page

### Summary

| # | File | Change |
|---|------|--------|
| 1 | `supabase/functions/channex-process-sync-queue/index.ts` | 3s → 30s delay |
| 2 | `src/components/pms/QuickRateGrid.tsx` | New component: calendar grid + inline editing + sync controls |
| 3 | `src/pages/pms/Prices.tsx` | Add tab switcher to toggle between Rate Plans view and Quick Editor |

