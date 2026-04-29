# Fix Apply button placement in Rate Guardrails

## Scope
File: `src/pages/DynamicPricing.tsx` only. No other files, no edge functions, no DB.

## Changes

### 1. Remove the per-row Apply button
In the OTA preview row inside the Rate Guardrails table (lines ~601–635), remove the `{isDirty && <Button>Apply</Button>}` block. The OTA markup preview content stays exactly as is — only the right-side Apply button is removed. The wrapping `flex items-start justify-between` container can be simplified (no longer needs `justify-between`), keeping the OTA preview content unchanged visually.

### 2. Compute "any dirty row" at the card level
Inside the Rate Guardrails CardContent (around the rateBounds mapping), derive a single boolean: whether any row has `draftMin !== savedMin || draftMax !== savedMax`. Implement by iterating `rateBounds` once and comparing each row's `inputDrafts[room_type]` (parsed via existing `parseDraft`) against `bound.min_rate` / `bound.max_rate`. Computed inline in the render (no new state, no hook), so no duplicate variable declarations with the per-row `draftMin/draftMax/savedMin/savedMax` already declared inside the `.map()` callback (different scope).

### 3. Add `applyAllBounds` helper
New function near `applyBound` (around line 246) that loops over `rateBounds`, and for each row whose draft differs from saved values, performs the same logic `applyBound` already does — pushing each change into `pendingBoundsChanges` via `setPendingBoundsChanges`. Reuses the existing per-row validation in `applyBound` by simply calling `applyBound(bound.room_type)` for each dirty row (single setState batching is fine here since React batches; if validation errors occur they surface in `boundsErrors` exactly like today).

### 4. New footer row at the bottom of the Rate Guardrails card
Replace the standalone `{lastChannexSync && <p>Last synced…</p>}` line (~646–648) with a single flex row:

```text
[ Last synced to Channex: <timestamp> ]                    [ Apply button ]
```

- Container: `flex items-center justify-between gap-4`
- Left: existing `<p className="text-xs text-muted-foreground">Last synced to Channex: {lastChannexSync}</p>` (rendered as empty span if no sync timestamp, so the Apply button still sits on the right)
- Right: `{anyDirty && <Button onClick={applyAllBounds} className="bg-black text-white hover:bg-black/90">Apply Changes</Button>}` — default size, default Button component from `@/components/ui/button`, only rendered when `anyDirty` is true

### 5. Untouched
- Save Changes flow at top of page
- Pending Changes card below Rate Guardrails
- OTA markup preview rows (content, weekend equivalent text, badges)
- Channex sync logic and `pendingBoundsChanges` queue semantics
- Edge functions, DB schema, RLS

## Behavior after change
- User edits Min/Max inputs across multiple rows → no per-row button appears
- A single black "Apply Changes" button appears at the bottom-right of the Rate Guardrails card
- Clicking it queues every dirty row into `pendingBoundsChanges` (existing Pending Changes card then shows them, and the existing Save Changes flow persists/syncs them)
- Button disappears once all drafts match saved values
