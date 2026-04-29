# Rate Guardrails Enhancements — DynamicPricing.tsx

Scope: only `src/pages/DynamicPricing.tsx`. No DB or Edge Function changes.

## 1. New state

- `channelMarkups: { id; channel_name; markup_percentage }[]` — loaded once on mount (alongside `loadBounds`).
- Replace existing `pendingBoundsChanges` value shape with the saved baseline + the typed (input) value:
  - `pendingBoundsChanges: Record<string, { original: { min: number|null; max: number|null }; pending: { min: number|null; max: number|null } }>`
- Keep `rateBounds` representing the **saved** values. Remove the current pattern where `updateBound` mutates `rateBounds` directly so the saved baseline isn't lost.
- Add `inputDrafts: Record<string, { min: string; max: string }>` for what's currently typed in each row's two inputs (string so empty is preserved). Initialised from `rateBounds` once loaded.

## 2. Load active channel markups

Inside `loadBounds` (or sibling `loadMarkups`) — query exactly like `src/pages/pms/Prices.tsx:187`:

```ts
withPropertyFilter(
  supabase.from('channel_markup_settings')
    .select('id, channel_name, markup_percentage')
    .eq('is_active', true),
  propertyId
)
```

Store in `channelMarkups` state.

## 3. Helpers

- `weekendRatio(bound) = bound.weekday_rate > 0 ? bound.weekend_rate / bound.weekday_rate : 1`
- `withMarkup(value, pct) = value == null ? null : value * (1 + pct/100)`
- `formatUsd(n) = n == null ? '—' : '$' + Math.round(n).toLocaleString()`

## 4. Rate Guardrails table — row layout changes (lines ~468-503)

Replace the single `<TableRow>` per bound with a fragment that renders the data row plus a sub-row spanning 5 columns containing the OTA preview + weekend equivalents + Apply button. Inputs read from `inputDrafts`, not `bound.min_rate`.

Per row:

- **Min Rate input** + inline muted text right of input: `Weekend: $[draftMin × ratio]` (only when draftMin is a valid number).
- **Max Rate input** + inline muted text: `Weekend: $[draftMax × ratio]`.
- **Sub-row (colSpan=5)**, visible when draft differs from saved OR per-row OTA preview is desired always:
  - For each `channelMarkups` entry: `<Badge>Booking.com</Badge> +18%  · Min: $X · Max: $Y` (computed from current draft values, falling back to saved if blank).
  - If `channelMarkups.length === 0`: muted text "No OTA channels connected".
  - Right-aligned **Apply** button (small) — visible only when `draftMin !== savedMin || draftMax !== savedMax`. On click: write the drafts into `pendingBoundsChanges[room_type]` with original = saved snapshot, pending = current drafts; clear validation error for that row.

Drop the existing `updateBound` (which mutated `rateBounds`) and replace with `setDraft(roomType, field, value)` that only updates `inputDrafts`.

## 5. Pending Changes card (new, below the Rate Guardrails card)

Mirror `BulkRestrictionEditor.tsx` lines 601-687.

- Visible only when `Object.keys(pendingBoundsChanges).length > 0`.
- Header: `Pending Changes` + description `[N] rate bound change(s) ready to save`.
- Each entry as `<div class="flex items-start justify-between p-3 bg-muted/50 rounded-lg">`:
  - Bold room type name.
  - Badges per changed field: `Min Rate: $80 → $100`, `Max Rate: $350 → $400` (only show changed fields).
  - For each active channel: muted line `Booking.com: $A → $B` per changed field (markup applied to original and pending).
  - Weekend equivalent line(s): `Weekend min: $orig×ratio → $pend×ratio`.
  - X button on the right that removes the entry from `pendingBoundsChanges` and resets that row's `inputDrafts` back to saved values.

No standalone "Save" button on this card; the sticky save bar handles it.

## 6. Save flow changes (`saveAllChanges`)

Current order already saves rules then rate bounds. After step 2 (rate bounds save) **only when `Object.keys(pendingBoundsChanges).length > 0`**:

1. Compute floor / ceiling from the **post-save** `rateBounds` merged with applied pendings:
   - `allMin = updatedBounds.map(b => b.min_rate).filter(v => v != null)`
   - `allMax = updatedBounds.map(b => b.max_rate).filter(v => v != null)`
   - `floor = allMin.length ? Math.min(...allMin) : null`
   - `ceiling = allMax.length ? Math.max(...allMax) : null`
2. `setSaveProgress(85); setChannexSyncStep('Syncing to Channex...')` (reuse the sticky bar's progress; no separate progress bar needed).
3. If `floor != null || ceiling != null`, call existing `supabase.functions.invoke('channex-update-property-settings', { body: { property_id: propertyId, min_price: floor, max_price: ceiling } })`. Throw on error.
4. On success: also update `pricing_rules.channex_min_price_synced` / `channex_max_price_synced` flags (same logic as today's `syncToChannex`), refresh local `rules`, write timestamp to localStorage (`dynamic_pricing_last_channex_sync_${propertyId}`), set `lastChannexSync`.
5. Apply the pending bound values into `rateBounds` (so saved baseline matches new state), then clear `pendingBoundsChanges`. Reset `inputDrafts` to the new saved values.
6. Toast: `Pricing settings saved and synced to Channex` (or just `Pricing settings saved` if no bound changes were in this save).
7. On any failure during the Channex step: toast error, **do NOT clear** `pendingBoundsChanges` so the operator can retry.

Make sure `pendingBoundsCount` (used for the sticky save bar count and label) reflects the new shape (`Object.keys(pendingBoundsChanges).length`).

## 7. Remove the standalone Channex sync card

Delete the entire `Section C: Channex Sync` card (lines ~514-553) including its button, progress bar, and `channex_*_synced` checkmarks. Delete `syncToChannex` function and `channexSyncStatus / channexSyncProgress / channexSyncStep` state — they are no longer used.

Re-add a small **"Last synced: [timestamp]"** muted line below the Rate Guardrails table (inside the existing Card's `CardContent`, below the info note at line 510), shown only when `lastChannexSync` is set. Keep the localStorage load effect (lines 100-105) intact.

## 8. Things explicitly untouched

- `channex-update-property-settings` Edge Function.
- DB schema / tables / RLS.
- Day-of-Week Multipliers, Revenue Targets, Last-Minute Strategy, Advanced Settings, Pace Index dialog.
- All other pages and components.

## 9. Safety checks

- Single declaration scan: `inputDrafts`, `channelMarkups`, `weekendRatio`, `withMarkup`, `formatUsd` declared exactly once in the component scope.
- Verified columns used: `channel_markup_settings.id, channel_name, markup_percentage, is_active, property_id` (confirmed via DB schema). `rate_plan_prices.min_rate, max_rate, weekday_rate, weekend_rate, room_type, id` (already in use).
- Query for markups copied verbatim from `src/pages/pms/Prices.tsx:187`.
- Pending Changes card structure copied from `src/components/pms/BulkRestrictionEditor.tsx:601-687`.
