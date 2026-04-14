

## Completed: Standardize rate_plan_restrictions to Dollars + Fix Sync Rate Overrides

### What Changed
- **Database**: Converted all `rate_plan_restrictions.rate` values from cents to dollars (`rate / 100.0`)
- **BulkRestrictionEditor.tsx**: Removed `* 100` when saving rates — now saves dollars directly
- **QuickRateGrid.tsx**: Removed `/ 100` when reading — data is now in dollars
- **channex-push-restrictions**: Added `Math.round(r.rate * 100)` to convert dollars → cents before Channex API
- **channex-full-sync**: Added rate override logic — reads from `rate_plan_restrictions` (priority 1) and `rate_plan_date_overrides` (priority 2), converting dollars → cents before pushing
- **channex-daily-sync**: Same rate override logic added

### Rate Storage Rule
- ALL rate tables store in **dollars** (the human-readable value)
- Cents conversion (`× 100`) only happens in edge functions right before Channex API calls
