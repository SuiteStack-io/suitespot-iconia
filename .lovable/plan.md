

## Fix: Room Rates admin page not filtering by active property

### Problem
`src/pages/RoomRates.tsx` fetches `rate_plans` and `rate_plan_prices` without any `property_id` filter, so it shows all properties' data regardless of the active property selection.

### Fix (single file: `src/pages/RoomRates.tsx`)

1. Import `usePropertyId` and `withPropertyFilter` from `@/hooks/usePropertyFilter`
2. Call `usePropertyId()` in the component
3. Re-fetch when `propertyId` changes (add to `useEffect` dependency)
4. Wrap the `rate_plans` query with `withPropertyFilter(query, propertyId)`
5. Update the breadcrumb to use the active property name instead of the hardcoded "ICONIA"

No database changes needed — `rate_plans` already has a `property_id` column.

