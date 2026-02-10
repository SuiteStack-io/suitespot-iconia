

## Create Channex Push Rates Edge Function

### Overview

Create a new edge function `channex-push-rates` that pushes rate and restriction updates to Channex via `/api/v1/restrictions`. Follows the exact same pattern as `channex-push-availability` but targets rate plans instead of room types, and converts decimal rates to cents.

---

### Request/Response Format

**Single Update:**
```json
{
  "property_id": "local-uuid",
  "rate_plan_id": "local-uuid",
  "date_from": "2026-03-01",
  "date_to": "2026-03-10",
  "rate": 150.00,
  "min_stay_arrival": 2,
  "stop_sell": false
}
```

**Batch Update:**
```json
{
  "updates": [
    {
      "property_id": "local-uuid",
      "rate_plan_id": "local-uuid",
      "date_from": "2026-03-01",
      "date_to": "2026-03-10",
      "rate": 150.00
    },
    {
      "property_id": "local-uuid",
      "rate_plan_id": "local-uuid-2",
      "date_from": "2026-03-01",
      "date_to": "2026-03-05",
      "rate": 200.00,
      "closed_to_arrival": true
    }
  ]
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Rates pushed successfully",
  "values_count": 2
}
```

---

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/channex-push-rates/index.ts` | Create new edge function |
| `supabase/config.toml` | Add `[functions.channex-push-rates]` with `verify_jwt = false` |

---

### Technical Details

#### Rate Conversion

Channex expects rates in the smallest currency unit (cents). The function multiplies the decimal rate by 100:

```typescript
// Convert 150.00 -> 15000
// Use Math.round to avoid floating-point issues (e.g. 150.10 * 100 = 15009.999...)
const rateInCents = Math.round(u.rate * 100);
```

#### Payload Construction

Only include optional restriction fields if they are explicitly provided (not undefined):

```typescript
const value: Record<string, unknown> = {
  property_id: channexPropertyId,
  rate_plan_id: channexRatePlanId,
  date_from: u.date_from,
  date_to: u.date_to,
  rate: Math.round(u.rate * 100),
};

// Only add optional restrictions if provided
if (u.min_stay_arrival !== undefined) value.min_stay_arrival = u.min_stay_arrival;
if (u.min_stay_through !== undefined) value.min_stay_through = u.min_stay_through;
if (u.closed_to_arrival !== undefined) value.closed_to_arrival = u.closed_to_arrival;
if (u.closed_to_departure !== undefined) value.closed_to_departure = u.closed_to_departure;
if (u.stop_sell !== undefined) value.stop_sell = u.stop_sell;
```

#### Validation

Each update validated for:
- `property_id` -- required
- `rate_plan_id` -- required
- `date_from` -- required, YYYY-MM-DD format
- `date_to` -- required, YYYY-MM-DD format
- `rate` -- required, must be a positive number

Optional restriction fields validated by type only (boolean for closed_to_arrival etc., number for min_stay).

#### ID Resolution

Same caching pattern as `channex-push-availability`, resolving `property` and `rate_plan` entity types from `channex_mappings`.

#### Error Handling

| Condition | Behavior |
|-----------|----------|
| Missing mapping for property | Skip update, add to errors array |
| Missing mapping for rate plan | Skip update, add to errors array |
| All updates failed mapping | Return 400 with errors |
| Channex API error | Return 502 with error details |
| Invalid input fields | Return 400 with validation error |

---

### Function Structure

Mirrors `channex-push-availability` exactly:

1. **CORS handling** -- Standard preflight response
2. **Method validation** -- POST only
3. **Authentication** -- Validate Authorization header
4. **Admin check** -- Query `user_roles` for admin role
5. **Input parsing** -- Normalize single/batch format
6. **Validation** -- Check required fields, validate rate is positive number
7. **Mapping resolution** -- Resolve Channex IDs (property + rate_plan) with caching
8. **Rate conversion** -- Multiply rate by 100 using `Math.round()`
9. **Build payload** -- Combine all valid updates into `values` array with optional restriction fields
10. **API call** -- Single POST to `/api/v1/restrictions`
11. **Log sync** -- Use shared `logSync()` utility
12. **Response** -- Return summary with count and any errors

