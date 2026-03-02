

## Fix: Filter Rate Plans by Active Property

The `fetchPlans` query in `src/pages/pms/Restrictions.tsx` has no property filter — it fetches all active rate plans across all properties.

### Changes
**File: `src/pages/pms/Restrictions.tsx`**
- Import `usePropertyId` from `@/hooks/usePropertyFilter`
- Get `propertyId` via `usePropertyId()`
- Add `.eq('property_id', propertyId)` to the `fetchPlans` query (when propertyId is available)
- Add `propertyId` to the `useEffect` dependency that calls `fetchPlans`, so switching properties re-fetches
- Reset `selectedPlanId` when property changes

