

## Add Optional Rate Field to Bulk Restriction Editor

### Overview

Add an optional "Rate" checkbox+input to the Bulk Editor form so rate and restrictions can be pushed to Channex in a single API call (required for certification Test 8).

### Database Change

Add a `rate` column to `rate_plan_restrictions`:

```sql
ALTER TABLE rate_plan_restrictions ADD COLUMN rate integer NULL;
```

This stores the rate in **cents** (matching Channex convention). NULL means "no rate override for this date range."

### File Changes

**1. `src/components/pms/BulkRestrictionEditor.tsx`**

- Add `rate?: number` to `PendingRestriction.restrictions` interface
- Add state: `enableRate` (boolean), `rate` (number, default 100)
- Add Rate checkbox+input row at the top of the restrictions section (before Min Stay Arrival)
- Update `validate()`: allow rate-only submissions (rate OR at least one restriction enabled)
- Update `handleApply()`: include `rate` in restrictions object if enabled
- Update `resetForm()`: reset rate state
- Update `handleSaveAllChanges()`: include `rate` (converted to cents) in DB insert rows
- Update pending changes display: show `Rate: $X` badge when present

**2. `supabase/functions/channex-push-restrictions/index.ts`**

- In the values loop, include `rate` from the restriction row if present:
  ```typescript
  ...(r.rate ? { rate: r.rate } : {}),
  ```

**3. `src/components/pms/RestrictionsLogTable.tsx`**

- Show rate badge in the restrictions column if `r.rate` exists:
  ```tsx
  {r.rate && <Badge variant="secondary">Rate: ${(r.rate / 100).toFixed(2)}</Badge>}
  ```

### Summary

- 1 migration (add `rate` column)
- 3 files modified
- Rate stored in cents, displayed in dollars
- Fully optional — existing restriction-only workflow unchanged

