## Add Annual Occupancy Target — Data Layer + Settings Input (Prompt 1 of 3)

This is the first of three prompts. Scope: schema migration + Step 4 form input only. No chart changes.

### 1. Database migration

```sql
ALTER TABLE properties
  ADD COLUMN occupancy_target_annual numeric NULL
  CHECK (occupancy_target_annual IS NULL OR (occupancy_target_annual >= 0 AND occupancy_target_annual <= 100));
```

- Nullable, no default — properties without a target are valid
- CHECK enforces 0–100 at the DB level (immutable expression, safe per Supabase guidelines)

### 2. PropertyForm — Step 4 changes

File: `src/components/settings/PropertyForm.tsx`

#### 2a. Form state (after line 113, `landlord_share_percentage`)

Stored as a string for clean optional/empty handling — same pattern as `vat_rate` (line 109) and `default_commission_rate` (line 110):

```ts
occupancy_target_annual:
  (property as any)?.occupancy_target_annual != null
    ? String((property as any).occupancy_target_annual)
    : '',
```

#### 2b. Validation — match existing pattern

The existing validator (`validateStep1`, lines 119–125) lives **outside** `handleSave`, just calls `toast.error` and returns `false`. No `setSaving` calls. Mirror it exactly with a new `validateStep4` and call it at the top of `handleSave` before `setSaving(true)`:

```ts
const validateStep4 = () => {
  if (form.occupancy_target_annual !== '') {
    const n = Number(form.occupancy_target_annual);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      toast.error('Annual Occupancy Target must be between 0 and 100');
      return false;
    }
  }
  return true;
};
```

In `handleSave`, before line 128 (`setSaving(true)`):

```ts
if (!validateStep4()) return;
```

No `setSaving(false)` in the validator — exactly matches `validateStep1`.

#### 2c. Payload (after line 167, `landlord_share_percentage`)

```ts
occupancy_target_annual:
  form.occupancy_target_annual !== '' ? Number(form.occupancy_target_annual) : null,
```

The existing `payload: any` cast on line 130 already bypasses stale generated types — no extra cast needed.

#### 2d. UI input (Step 4, inserted after the landlord-share block at line ~636, still inside the same `border rounded-lg` card, OUTSIDE the `form.has_landlord` conditional so it's always visible)

```tsx
<div className="pt-2">
  <Label htmlFor="occupancy-target-annual">Annual Occupancy Target (%)</Label>
  <div className="relative mt-1">
    <Input
      id="occupancy-target-annual"
      type="number"
      min={0}
      max={100}
      step={1}
      placeholder="e.g. 75"
      value={form.occupancy_target_annual}
      onChange={(e) => update('occupancy_target_annual', e.target.value)}
      className="pr-8"
    />
    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
      %
    </span>
  </div>
  <p className="text-xs text-muted-foreground mt-1">
    Optional. Used to display a target line on the Occupancy by Month chart.
  </p>
</div>
```

Visual style mirrors the existing landlord-share input (same `%` adornment + helper-text pattern).

### 3. Out of scope (handled in the next two prompts)

- `OccupancyByMonthChart.tsx`
- `Analytics.tsx`
- Any KPI card or chart line rendering

### 4. Files touched

- New migration on `properties`
- `src/components/settings/PropertyForm.tsx` — state init, new `validateStep4`, one-line guard at top of `handleSave`, payload addition, and one new input block in Step 4

No changes to Steps 1/2/3/5, no changes to existing Step 4 fields, no changes to the create-mode success screen.