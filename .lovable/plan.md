

## Fix: "Always active" radio button disabled when editing

### Root Cause
Line 252 in `RatePlanDialog.tsx`:
```tsx
<RadioGroupItem value="always" id="always" disabled={isEditing && !ratePlan?.is_default} />
```
When editing a non-default rate plan (like "Bed & Breakfast Rate" which has a date range), `isEditing` is `true` and `ratePlan?.is_default` is `false`, so the "Always active" option is disabled.

### Fix
Remove the `disabled` prop entirely. Users should be able to switch any rate plan between "always active" and "date range" modes when editing.

### File
- `src/components/pms/RatePlanDialog.tsx` — line 252: remove `disabled={isEditing && !ratePlan?.is_default}`

