

## Create Channex Rate Plan Edge Function

### Overview

Create a new edge function `channex-create-rate-plan` that syncs a local rate plan to Channex. The function follows the established pattern from `channex-create-property`, using the shared Channex client utilities.

---

### Request/Response Format

**POST Request Body:**
```json
{
  "rate_plan_id": "local-rate-plan-uuid",
  "room_type_id": "local-room-type-uuid", 
  "property_id": "local-property-uuid"
}
```

**Success Response:**
```json
{
  "success": true,
  "channex_rate_plan_id": "channex-uuid",
  "message": "Rate plan created successfully in Channex"
}
```

---

### Implementation Flow

```text
1. Validate POST method
           ↓
2. Authenticate user (Authorization header)
           ↓
3. Verify admin role
           ↓
4. Parse request body
           ↓
5. Look up Channex property ID from channex_mappings
           ↓
6. Look up Channex room type ID from channex_mappings
           ↓
7. Look up rate plan details from rate_plans table
           ↓
8. Check if rate plan already mapped to Channex
           ↓
9. Transform to Channex format
           ↓
10. POST to /api/v1/rate_plans
           ↓
11. Save mapping to channex_mappings
           ↓
12. Log sync and return response
```

---

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/channex-create-rate-plan/index.ts` | Create new edge function |
| `supabase/config.toml` | Add function configuration |

---

### Technical Details

#### Channex API Payload Structure

The function will transform local data to Channex's rate plan format:

```typescript
const channexRatePlanData = {
  rate_plan: {
    title: ratePlan.name,           // From rate_plans.name
    property_id: channexPropertyId, // Looked up from channex_mappings
    room_type_id: channexRoomTypeId,// Looked up from channex_mappings  
    currency: ratePlan.currency || 'USD',
    sell_mode: ratePlan.sell_mode || 'per_room',
    rate_mode: 'manual',            // Fixed value
    options: [
      {
        occupancy: ratePrice.base_occupancy || 2,
        is_primary: true,
        rate: 0                      // Initial rate (updated separately)
      }
    ]
  }
};
```

#### Database Lookups

1. **Property Channex ID**: Query `channex_mappings` where `local_id = property_id` and `entity_type = 'property'`

2. **Room Type Channex ID**: Query `channex_mappings` where `local_id = room_type_id` and `entity_type = 'room_type'`

3. **Rate Plan Details**: Query `rate_plans` by `id` to get `name`, `currency`, `sell_mode`

4. **Rate Plan Price** (for occupancy): Query `rate_plan_prices` to get `base_occupancy`

#### Error Handling

| Condition | HTTP Status | Error Message |
|-----------|-------------|---------------|
| Property not synced | 400 | "Property must be synced to Channex first" |
| Room type not synced | 400 | "Room type must be synced to Channex first" |
| Rate plan not found | 404 | "Rate plan not found in database" |
| Already mapped | 409 | "Rate plan is already mapped to Channex" |
| Channex API error | 502 | "Channex API error: [details]" |

#### Mapping Storage

After successful Channex creation, store in `channex_mappings`:

```typescript
{
  local_id: rate_plan_id,
  channex_id: channexResponse.data.id,
  entity_type: 'rate_plan',
  sync_status: 'synced',
  last_synced_at: new Date().toISOString(),
  channex_data: channexResponse.data
}
```

---

### Config Update

Add to `supabase/config.toml`:

```toml
[functions.channex-create-rate-plan]
verify_jwt = false
```

---

### Function Structure

The edge function will follow the same structure as `channex-create-property`:

1. **CORS handling** - Standard preflight response
2. **Method validation** - POST only
3. **Authentication** - Validate Authorization header with user token
4. **Admin check** - Query `user_roles` for admin role
5. **Input validation** - Require all three IDs
6. **Mapping lookups** - Find Channex IDs for property and room type
7. **Rate plan lookup** - Get local rate plan details
8. **Duplicate check** - Ensure not already mapped
9. **API call** - POST to Channex `/api/v1/rate_plans`
10. **Save mapping** - Insert into `channex_mappings`
11. **Log sync** - Use shared `logSync()` utility
12. **Response** - Return success with Channex rate plan ID

