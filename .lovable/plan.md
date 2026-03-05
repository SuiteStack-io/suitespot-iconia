

## Fix: Date To Calendar Opens to Correct Month

### Change

**File:** `src/components/pms/BulkRestrictionEditor.tsx` (line 378)

Add `defaultMonth` prop to the Date To Calendar component:

```diff
- <Calendar mode="single" selected={dateTo} onSelect={setDateTo} disabled={(d) => d < (dateFrom || today)} className="p-3 pointer-events-auto" />
+ <Calendar mode="single" selected={dateTo} onSelect={setDateTo} defaultMonth={dateTo || dateFrom || today} disabled={(d) => d < (dateFrom || today)} className="p-3 pointer-events-auto" />
```

This makes the calendar open to November 2026 (the auto-filled date's month) instead of the current month.

