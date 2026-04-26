# Add "Has Landlord" Toggle to Property Settings + Conditional Analytics Display

Adds a `has_landlord` flag (default `true`) and a Landlord Revenue Share % field to Step 4 of the Edit Property modal. The Analytics page hides the Revenue Share slider and the landlord/operator breakdown rows when the property has no landlord. Existing properties keep current behavior because the new column defaults to `true`.

## 1. Database migration

```sql
ALTER TABLE public.properties
  ADD COLUMN has_landlord boolean NOT NULL DEFAULT true;
```

The column rides along on the existing `select('*')` in `PropertyContext` — no new query, no `types.ts` edits (auto-regenerated). The `UPDATE … WHERE has_landlord IS NULL` step is unnecessary because the column is `NOT NULL DEFAULT true` (existing rows are backfilled by the default).

## 2. `src/components/settings/PropertyForm.tsx` — add two fields to Step 4

### Form state (around line 110)

Add to the initializer:
```ts
has_landlord: ((property as any)?.has_landlord ?? true) as boolean,
landlord_share_percentage: ((property as any)?.landlord_share_percentage ?? 70) as number,
```
(Verified: `landlord_share_percentage` is NOT yet in form state.)

### `update` helper (line 114)

Currently typed `(key: string, val: string)`. Loosen the value type so the toggle (boolean) and number input can use the same setter without a type error:
```ts
const update = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));
```

### Step 4 UI (after the Revenue Recognition Method `<div>`, before line 593's closing `</div>`)

Add inside the same `border rounded-lg p-4 space-y-3` card, below the Select:

- **Has Landlord row**: a horizontal flex row with a `<Label htmlFor="has-landlord">Has Landlord</Label>` and a `<Switch>` (import from `@/components/ui/switch` — same component used elsewhere). Wires to `form.has_landlord` ↔ `update('has_landlord', v)`.
- **Landlord Revenue Share (%)** — rendered only when `form.has_landlord === true`:
  - `<Label htmlFor="landlord-share">Landlord Revenue Share (%)</Label>`
  - `<Input id="landlord-share" type="number" min={0} max={100} step={1} value={form.landlord_share_percentage} onChange={e => update('landlord_share_percentage', Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />` (same `Input` component used across Steps 1–3)
  - Trailing `%` shown as helper text on the right or as suffix span next to the input
  - Helper line below: `<p className="text-xs text-muted-foreground mt-1">Operator share: {100 - form.landlord_share_percentage}%</p>` (live-updates)

### Save payload (around line 162)

Add to the existing `payload: any`:
```ts
has_landlord: form.has_landlord,
landlord_share_percentage: form.landlord_share_percentage,
```
Always save `landlord_share_percentage` regardless of `has_landlord` so toggling OFF/ON preserves the user's last value.

## 3. `src/pages/Analytics.tsx` — conditional display

### 3a. Derive `hasLandlord` (near line 55, alongside `savedLandlordPercentage`)

```ts
const hasLandlord: boolean = ((activeProperty as any)?.has_landlord ?? true) as boolean;
```
Default to `true` to preserve behavior if the column is missing in any edge case.

### 3b. Wrap the Revenue Share Card (lines 980–1008)

```tsx
{hasLandlord && (
  <Card className="bg-gradient-to-r from-card to-card/80">
    {/* … existing slider, labels, Save button — UNCHANGED … */}
  </Card>
)}
```

### 3c. Wrap landlord/operator breakdown rows on Gross + Net Revenue cards

- Gross Revenue card (lines 1092–1095): wrap the inner `<div className="mt-2 space-y-1 text-xs text-muted-foreground">` with `{hasLandlord && (…)}` so only the headline `${revenueStats.totalRevenue}` shows when off.
- Net Revenue card (lines 1110–1113): same treatment.

Headline `$` numbers stay visible regardless. No other KPI card touched.

### 3d. Keep all slider state and handlers as-is

Do NOT remove `landlordPercentage`, `setLandlordPercentage`, `savedLandlordPercentage`, `savingShare`, `handleSaveShare`, or the sync `useEffect`. They remain valid; they simply have no rendered control when `hasLandlord = false`. The detail dialogs (lines 1378+, 1411+) and Excel export columns continue to reference `landlordPercentage` — leaving them intact is intentional and outside this prompt's scope.

### 3e. Bidirectional sync — already works

- Modal save → `refreshProperties()` → `activeProperty.landlord_share_percentage` changes → existing `useEffect` (line 190) syncs the slider.
- Slider Save → updates the same `landlord_share_percentage` column → next modal open reads the latest value via the form initializer.

## 4. Out of scope (explicitly unchanged)

- Steps 1–3 of the Edit Property modal
- Revenue Recognition Method dropdown wiring (already in Step 4)
- Date range pills, Custom Range picker, Export button, Occupancy by Month chart, four revenue tables
- Revenue Share slider's local state and `handleSaveShare` handler
- `applyRevenueDateFilter` and revenue calculation logic
- Weekly summary emails
- Headline `$` numbers on Gross/Net Revenue cards

## Acceptance check

- New property defaults to `has_landlord = true` (DB default) → Analytics behaves exactly as today.
- Existing ICONIA property unchanged after migration.
- Toggling OFF in modal → save → Analytics no longer shows Revenue Share slider; Gross/Net cards show only headline `$` figures.
- Toggling ON again → slider reappears with the user's last-saved percentage; breakdown rows reappear.
- Editing percentage in modal and saving updates the slider on Analytics; editing slider on Analytics and saving is reflected on next modal open.
