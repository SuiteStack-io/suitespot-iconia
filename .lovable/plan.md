

## Fix: Price Lab Changes Not Displayed After Save + Add Progress Bar

### Problem
In `syncNow()` (line 472), `setPendingChanges(new Map())` clears pending changes but the `prices` state still holds old rates, so the grid reverts to showing old values.

### Fix in `src/components/pms/QuickRateGrid.tsx`

**1. Before clearing pendingChanges, update `prices` state (line 471-472)**

Insert before `setPendingChanges(new Map())`:
```typescript
// Update local prices state so grid keeps showing new values
setPrices(prev => {
  const updated = { ...prev };
  pendingChanges.forEach(change => {
    const existing = updated[change.ratePlanId];
    if (!existing) return;
    updated[change.ratePlanId] = {
      ...existing,
      ...(change.isWeekend
        ? { weekend_rate: change.newRate }
        : { weekday_rate: change.newRate }),
    };
  });
  return updated;
});
```

Note: Since multiple changes for the same plan may set both weekday and weekend rates, this iterates all changes and applies each one, correctly merging both rate types.

**2. Add progress bar**

- Import `Progress` from `@/components/ui/progress`
- Add `syncProgress` state (0-100)
- Update `syncNow` to set progress milestones: 10% (start), 40% (after queue inserts), 70% (after process invocation), 100% (done), then reset to 0 after a delay
- Render a black-styled `<Progress>` bar below the toolbar when `syncing || syncProgress > 0`

### Single file change: `src/components/pms/QuickRateGrid.tsx`

