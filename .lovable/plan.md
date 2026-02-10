

## Create Channex Push Availability Edge Function

### Overview

Create a new edge function `channex-push-availability` that pushes availability updates to Channex. The function supports both single and batch updates in one endpoint, combining all updates into a single Channex API call for efficiency.

---

### Request/Response Format

**Single Update:**
```json
{
  "property_id": "local-uuid",
  "room_type_id": "local-uuid",
  "date_from": "2026-03-01",
  "date_to": "2026-03-10",
  "availability": 5
}
```

**Batch Update:**
```json
{
  "updates": [
    {
      "property_id": "local-uuid",
      "room_type_id": "local-uuid",
      "date_from": "2026-03-01",
      "date_to": "2026-03-10",
      "availability": 5
    },
    {
      "property_id": "local-uuid",
      "room_type_id": "local-uuid-2",
      "date_from": "2026-03-01",
      "date_to": "2026-03-05",
      "availability": 3
    }
  ]
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Availability pushed successfully",
  "values_count": 2
}
```

---

### Implementation Flow

```text
1. Validate POST method and authenticate admin user
           |
           v
2. Parse body: normalize single update or batch into an array
           |
           v
3. For each update:
   - Look up Channex property ID from channex_mappings
   - Look up Channex room type ID from channex_mappings
   - Build a value entry with Channex IDs
   - Collect errors for missing mappings (continue with others)
           |
           v
4. Send single POST to /api/v1/availability with all values
           |
           v
5. Log the sync and return summary
```

---

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/channex-push-availability/index.ts` | Create new edge function |
| `supabase/config.toml` | Add `[functions.channex-push-availability]` with `verify_jwt = false` |

---

### Technical Details

#### Input Normalization

The function accepts both formats and normalizes to an array internally:

```typescript
// If body has "updates" array, use it; otherwise treat entire body as single update
const updates = body.updates
  ? body.updates
  : [{ property_id: body.property_id, room_type_id: body.room_type_id,
       date_from: body.date_from, date_to: body.date_to, availability: body.availability }];
```

#### Channex ID Resolution with Caching

To avoid redundant DB queries when the same property/room type appears multiple times in a batch:

```typescript
const mappingCache: Record<string, string> = {};

async function resolveChannexId(supabase, localId: string, entityType: string): Promise<string | null> {
  const cacheKey = `${entityType}:${localId}`;
  if (mappingCache[cacheKey]) return mappingCache[cacheKey];

  const { data } = await supabase
    .from('channex_mappings')
    .select('channex_id')
    .eq('local_id', localId)
    .eq('entity_type', entityType)
    .maybeSingle();

  if (data) mappingCache[cacheKey] = data.channex_id;
  return data?.channex_id || null;
}
```

#### Channex Payload

All resolved updates are combined into a single API call:

```typescript
const channexPayload = {
  values: [
    {
      property_id: "channex-property-id",
      room_type_id: "channex-room-type-id",
      date_from: "2026-03-01",
      date_to: "2026-03-10",
      availability: 5
    },
    // ... more values
  ]
};

await channexRequest('POST', '/api/v1/availability', channexPayload);
```

#### Validation

Each update in the array is validated for:
- `property_id` -- required
- `room_type_id` -- required
- `date_from` -- required, YYYY-MM-DD format
- `date_to` -- required, YYYY-MM-DD format
- `availability` -- required, must be a non-negative number

#### Error Handling

| Condition | Behavior |
|-----------|----------|
| Missing mapping for property/room type | Skip that update, add to errors array |
| All updates failed mapping resolution | Return 400 with errors |
| Channex API error | Return 502 with error details |
| Invalid input fields | Return 400 with validation error |

**Response with partial errors:**
```json
{
  "success": true,
  "message": "Availability pushed with some errors",
  "values_count": 3,
  "errors": [
    { "index": 1, "error": "Room type not synced to Channex", "room_type_id": "local-uuid" }
  ]
}
```

#### Authentication & Authorization

Same pattern as all other Channex functions: validate Authorization header, verify admin role via `user_roles` table.

---

### Function Structure

1. **CORS handling** -- Standard preflight response
2. **Method validation** -- POST only
3. **Authentication** -- Validate Authorization header
4. **Admin check** -- Query `user_roles` for admin role
5. **Input parsing** -- Normalize single/batch format
6. **Validation** -- Check required fields on each update
7. **Mapping resolution** -- Resolve Channex IDs with caching
8. **Build payload** -- Combine all valid updates into `values` array
9. **API call** -- Single POST to `/api/v1/availability`
10. **Log sync** -- Use shared `logSync()` utility
11. **Response** -- Return summary with count and any errors

