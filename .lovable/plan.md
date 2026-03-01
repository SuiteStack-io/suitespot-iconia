

## Fix: Room Rates page not filtering by active property

### Problem
On `src/pages/front-desk/RoomRates.tsx`, the `units` and `rate_plans` queries fetch **all** records across all properties. Only `channel_markup_settings` uses `withPropertyFilter`. This causes the Test property to show ICONIA's room types and rates.

### Fix (single file: `src/pages/front-desk/RoomRates.tsx`)

Wrap the `units` and `rate_plans` queries with `withPropertyFilter(query, propertyId)`:

1. **Units query** (line 44-47): Add `.eq('property_id', propertyId)` via `withPropertyFilter`
2. **Rate plans query** (line 49-52): Add `.eq('property_id', propertyId)` via `withPropertyFilter`

Both tables already have a `property_id` column, so no database changes needed.

