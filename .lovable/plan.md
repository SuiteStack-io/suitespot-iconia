

## Fix: Rate plan creation fails due to missing `property_id`

### Root Cause
The RLS policy on `rate_plans` requires `user_has_property_access(property_id, 'manager')`. Both the create flow in `Prices.tsx` and the bulk create in `BulkRatePlanDialog.tsx` insert rows without setting `property_id`, causing a "violates row-level security policy" error.

### Changes

**1. `src/pages/pms/Prices.tsx` (line 234)**
Add `property_id: propertyId` to the insert object so the RLS check passes.

**2. `src/components/pms/BulkRatePlanDialog.tsx`**
- Add `propertyId` prop to the interface
- Include `property_id: propertyId` in the insert (line 76-82)
- The parent (`Prices.tsx`) already has `propertyId` and will pass it down

Both fixes are one-line additions each. No database or schema changes needed.

