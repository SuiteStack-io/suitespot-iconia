## Queued save pattern for Advanced — Occupancy & Revenue Tiers

All edits in `src/pages/DynamicPricing.tsx`. No DB / edge-function / other-file changes.

### 1. New state (in `DynamicPricing` component, near existing pending state ~line 105)

```ts
type TierKey = 'occupancy_adjustments' | 'revenue_adjustments_phase_a' | 'revenue_adjustments_phase_b';
const [tierDrafts, setTierDrafts] = useState<{
  occupancy_adjustments?: number[];
  revenue_adjustments_phase_a?: number[];
  revenue_adjustments_phase_b?: number[];
}>({});
const [pendingTierChanges, setPendingTierChanges] = useState<{
  occupancy_adjustments?: number[];
  revenue_adjustments_phase_a?: number[];
  revenue_adjustments_phase_b?: number[];
}>({});
```

`tierDrafts[key][idx]` = sparse array of in-flight edits (use `undefined` for "untouched", `number` for edited cell).
`pendingTierChanges[key]` = full-length array (length = `rules[key].length`) where each cell is the queued value, or equal to the saved baseline if not changed.

### 2. Update pending counts (replace existing 3 lines ~108-110)

Compute `pendingTierCount` by counting cells in `pendingTierChanges[key]` that differ from `rules[key]`. Add to `totalPendingChanges`.

### 3. Helpers (component scope)

```ts
function resolveTierValue(key: TierKey, idx: number): number {
  const draft = tierDrafts[key]?.[idx];
  if (draft !== undefined) return draft;
  const pending = pendingTierChanges[key]?.[idx];
  if (pending !== undefined) return pending;
  return rules![key][idx] ?? 0;
}
function setTierDraft(key: TierKey, idx: number, raw: string) {
  const parsed = raw === '' ? 0 : parseFloat(raw);
  setTierDrafts(prev => {
    const arr = [...(prev[key] ?? [])];
    arr[idx] = isNaN(parsed) ? 0 : parsed;
    return { ...prev, [key]: arr };
  });
}
function isTierRowDirty(key: TierKey, idx: number): boolean {
  const draft = tierDrafts[key]?.[idx];
  if (draft === undefined) return false;
  const baseline = pendingTierChanges[key]?.[idx] ?? rules![key][idx];
  return draft !== baseline;
}
const hasAnyDirtyTier = (['occupancy_adjustments','revenue_adjustments_phase_a','revenue_adjustments_phase_b'] as TierKey[])
  .some(k => (tierDrafts[k] ?? []).some((_, i) => isTierRowDirty(k, i)));
```

### 4. Apply Changes (in-card button)

```ts
function applyTierChanges() {
  const keys: TierKey[] = ['occupancy_adjustments','revenue_adjustments_phase_a','revenue_adjustments_phase_b'];
  // Validate
  for (const k of keys) {
    const draft = tierDrafts[k];
    if (!draft) continue;
    for (let i = 0; i < draft.length; i++) {
      const v = draft[i];
      if (v === undefined) continue;
      if (!isFinite(v) || v < 0 || v > 100) {
        toast.error('Tier values must be between 0 and 100');
        return;
      }
    }
  }
  setPendingTierChanges(prev => {
    const next = { ...prev };
    for (const k of keys) {
      const draft = tierDrafts[k];
      if (!draft) continue;
      const baseFull = (next[k] ?? rules![k]).slice();
      for (let i = 0; i < draft.length; i++) {
        if (draft[i] !== undefined) baseFull[i] = draft[i] as number;
      }
      next[k] = baseFull;
    }
    return next;
  });
  setTierDrafts({});
  toast.success('Tier changes added to pending');
}
function discardPendingTierChanges() {
  setPendingTierChanges({});
  setTierDrafts({});
}
```

### 5. Modify `saveAllChanges` (around lines 311-442)

- Build merged rules patch:
  ```ts
  const rulesPatch: Partial<PricingRules> = { ...pendingRulesChanges, ...pendingTierChanges };
  const hasRulesChanges = Object.keys(rulesPatch).length > 0;
  ```
  Replace the existing `if (pendingRulesCount > 0)` block to use `hasRulesChanges` and `toDbRow(rulesPatch)`.

- After successful save, set `setRules(prev => prev ? { ...prev, ...pendingTierChanges } : prev)` so baseline reflects new values.

- Trigger Channex sync after successful pricing_rules update **only if** there were tier or rules changes (separate from existing bounds-only sync). Use:
  ```ts
  const { error: syncErr } = await supabase.functions.invoke('channex-full-sync', { body: { propertyId } });
  ```
  Wrap in try/catch so it can't fail the whole save. On `syncErr` show toast `"Settings saved. Channex sync failed — please retry sync."` (non-fatal). On success show `"Settings saved and synced to Channex"`.
  
  Important: Keep existing bounds-only sync (`channex-update-property-settings`) untouched. Only call `channex-full-sync` when `pendingRulesCount > 0 || pendingTierCount > 0` (i.e. rule/tier changes that affect calculated rates). The success toast wording at the end should be:
  - rules/tier changes saved + sync ok → "Settings saved and synced to Channex"
  - rules/tier changes saved + sync failed → "Settings saved. Channex sync failed — please retry sync."
  - bounds-only path keeps existing message.

- On success: `setPendingRulesChanges({}); setPendingBoundsChanges({}); setPendingTierChanges({}); setTierDrafts({});`

### 6. Replace tier inputs in Section G (lines 899-922 occupancy table; 956-984 revenue table)

Each `<Input>`:
- `value={resolveTierValue('occupancy_adjustments', idx)}`
- `onChange={(e) => setTierDraft('occupancy_adjustments', idx, e.target.value)}`
- Add `className={cn('w-20', isTierRowDirty('occupancy_adjustments', idx) && 'border-amber-500')}` to subtly highlight dirty rows (matches Rate Guardrails amber-border pattern).
- Same for `revenue_adjustments_phase_a` and `revenue_adjustments_phase_b`.

Remove the previous `updateRules({ occupancy_adjustments: newAdj })` / phase_a / phase_b calls — these inputs are now decoupled from the immediate `pendingRulesChanges` flow.

(Note: Pace Index Bump Threshold input at lines 934-940 stays on the existing `updateRules` flow — outside scope of this change.)

### 7. Apply button + Pending Tier Changes summary

At the bottom of Section G `<CardContent>` (just before closing tag, after the revenue tier table):

```tsx
<div className="flex justify-end pt-2">
  {hasAnyDirtyTier && (
    <Button
      type="button"
      onClick={applyTierChanges}
      className="bg-black text-white hover:bg-black/90"
      size="sm"
    >
      Apply Changes
    </Button>
  )}
</div>

{pendingTierCount > 0 && (
  <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
    <div className="flex items-center justify-between gap-2 mb-1">
      <span className="font-medium">{pendingTierCount} tier change{pendingTierCount === 1 ? '' : 's'} ready to save</span>
      <Button type="button" variant="ghost" size="sm" onClick={discardPendingTierChanges}>Discard</Button>
    </div>
    <ul className="text-xs text-muted-foreground space-y-0.5">
      {(['occupancy_adjustments','revenue_adjustments_phase_a','revenue_adjustments_phase_b'] as TierKey[]).flatMap(k => {
        const arr = pendingTierChanges[k] ?? [];
        const baseline = rules[k] ?? [];
        return arr.map((v, i) => v !== baseline[i] ? (
          <li key={`${k}-${i}`}>
            {labelForTier(k, i)}: {baseline[i]}% → {v}%
          </li>
        ) : null).filter(Boolean);
      })}
    </ul>
  </div>
)}
```

`labelForTier` helper inside component:
- `occupancy_adjustments` → derive from `rules.occupancy_thresholds`: `Occupancy {from}-{to}%`
- `revenue_adjustments_phase_a` → `Revenue ≥ {rules.revenue_thresholds[i]}% (Phase A)`
- `revenue_adjustments_phase_b` → `Revenue ≥ {rules.revenue_thresholds[i]}% (Phase B)`

### 8. Reset behavior

No existing Reset button on Section G in the file (only Day-of-Week section has one). No new Reset button is added; spec only says "if it exists". Confirmed it does not — skip.

### 9. Verification / no-duplicate-decl

- New identifiers: `tierDrafts`, `pendingTierChanges`, `pendingTierCount`, `TierKey`, `resolveTierValue`, `setTierDraft`, `isTierRowDirty`, `hasAnyDirtyTier`, `applyTierChanges`, `discardPendingTierChanges`, `labelForTier`. Searched file — none of these names exist elsewhere.
- `totalPendingChanges` already declared once; the new computation replaces only the existing line.
- `channex-full-sync` invocation pattern verified against `src/components/channex/PropertySync.tsx:122-128` (same body shape `{ propertyId }`).
- `pricing_rules` columns used: `occupancy_adjustments`, `revenue_adjustments_phase_a`, `revenue_adjustments_phase_b` — all confirmed in supabase tables context, and already mapped via existing `toDbRow`.

### Out of scope
Rate Guardrails section, Day-of-Week multipliers, dashboard, overrides, promotions, edge functions, helper module, DB schema.
