

## Create Channex Sync Property Edge Function

### Overview

Create a comprehensive edge function `channex-sync-property` that performs a complete sync of a property and all its room types and rate plans to Channex in a single operation. The function continues processing even if individual items fail, collecting all errors for the final summary.

---

### Request/Response Format

**POST Request Body:**
```json
{
  "property_id": "local-property-uuid"
}
```

**Success Response:**
```json
{
  "success": true,
  "property": { 
    "local_id": "uuid", 
    "channex_id": "channex-uuid",
    "status": "created" 
  },
  "room_types": [
    { "local_id": "uuid", "channex_id": "channex-uuid", "name": "Deluxe Suite", "status": "created" },
    { "local_id": "uuid", "channex_id": "channex-uuid", "name": "Standard Room", "status": "already_synced" }
  ],
  "rate_plans": [
    { "local_id": "uuid", "channex_id": "channex-uuid", "name": "Standard Rate", "status": "created" },
    { "local_id": "uuid", "channex_id": "channex-uuid", "name": "Non-Refundable", "status": "already_synced" }
  ],
  "errors": []
}
```

**Partial Success Response (with errors):**
```json
{
  "success": true,
  "property": { "local_id": "uuid", "channex_id": "channex-uuid", "status": "already_synced" },
  "room_types": [...],
  "rate_plans": [...],
  "errors": [
    { "entity": "rate_plan", "local_id": "uuid", "name": "Weekend Special", "error": "Room type not synced" }
  ]
}
```

---

### Implementation Flow

```text
1. Validate POST method and authenticate admin user
           │
           ▼
2. Check if property exists in channex_mappings
           │
   ┌───────┴───────┐
   │               │
   ▼               ▼
Already        Not synced
synced         → Create in Channex
(use ID)       → Save mapping
   │               │
   └───────┬───────┘
           ▼
3. Get all unique room types for this property
   (grouped by booking_com_name || name)
           │
           ▼
4. For each room type:
   ├── Check if already synced → skip with status "already_synced"
   └── Not synced → Create in Channex
       ├── Transform to Channex format
       ├── POST to /api/v1/room_types
       ├── Save mapping
       └── Log result (continue on error)
           │
           ▼
5. Get all rate plans from database
           │
           ▼
6. For each rate plan:
   ├── Check if already synced → skip with status "already_synced"
   └── Not synced → Create in Channex
       ├── Find first applicable room type with Channex mapping
       ├── Transform to Channex format
       ├── POST to /api/v1/rate_plans
       ├── Save mapping
       └── Log result (continue on error)
           │
           ▼
7. Return complete summary with all results and errors
```

---

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/channex-sync-property/index.ts` | Create new edge function |
| `supabase/config.toml` | Add function configuration |

---

### Technical Details

#### 1. Property Sync Logic

```typescript
// Check if property already synced
const { data: existingPropertyMapping } = await supabaseAdmin
  .from('channex_mappings')
  .select('channex_id')
  .eq('local_id', property_id)
  .eq('entity_type', 'property')
  .maybeSingle();

if (existingPropertyMapping) {
  // Use existing Channex ID
  channexPropertyId = existingPropertyMapping.channex_id;
  propertyResult = { local_id: property_id, channex_id: channexPropertyId, status: 'already_synced' };
} else {
  // Create property in Channex (same logic as channex-create-property)
  const channexResponse = await channexRequest('POST', '/api/v1/properties', payload);
  channexPropertyId = channexResponse.data.id;
  // Save mapping...
  propertyResult = { local_id: property_id, channex_id: channexPropertyId, status: 'created' };
}
```

#### 2. Room Type Grouping

Room types are grouped by display name (`booking_com_name || name`) and one representative unit ID is used for the Channex sync:

```typescript
// Get all units for the property location
const { data: units } = await supabaseAdmin
  .from('units')
  .select('id, name, booking_com_name, max_guests, max_children, max_infants, default_occupancy, room_kind, count_of_rooms')
  .eq('location', 'ICONIA')
  .or('is_private.eq.false,is_private.is.null');

// Group by display name
const roomTypeGroups = {};
units.forEach(unit => {
  const displayName = unit.booking_com_name || unit.name;
  if (!roomTypeGroups[displayName]) {
    roomTypeGroups[displayName] = {
      unitId: unit.id,  // Use first unit as representative
      displayName,
      ...unit
    };
  }
});
```

#### 3. Channex Room Type Payload

```typescript
const channexRoomTypeData = {
  room_type: {
    title: roomType.displayName,
    property_id: channexPropertyId,
    count_of_rooms: roomType.count_of_rooms || 1,
    occ_adults: roomType.max_guests || 2,
    occ_children: roomType.max_children || 0,
    occ_infants: roomType.max_infants || 0,
    default_occupancy: roomType.default_occupancy || 2,
    kind: roomType.room_kind || 'room'
  }
};
```

#### 4. Rate Plan Sync Logic

For each rate plan, find the first applicable room type that has a Channex mapping:

```typescript
for (const ratePlan of ratePlans) {
  // Find a room type with Channex mapping from applicable_room_types
  let channexRoomTypeId = null;
  let matchedRoomType = null;
  
  for (const roomTypeName of ratePlan.applicable_room_types || []) {
    const mapping = await supabaseAdmin
      .from('channex_mappings')
      .select('channex_id, local_id')
      .eq('entity_type', 'room_type')
      .maybeSingle();
    
    if (mapping) {
      channexRoomTypeId = mapping.channex_id;
      matchedRoomType = roomTypeName;
      break;
    }
  }
  
  if (!channexRoomTypeId) {
    errors.push({ entity: 'rate_plan', local_id: ratePlan.id, name: ratePlan.name, error: 'No synced room type found' });
    continue;
  }
  
  // Create rate plan in Channex...
}
```

#### 5. Error Handling Strategy

The function continues processing even when individual items fail:

```typescript
const errors: Array<{ entity: string; local_id: string; name: string; error: string }> = [];
const roomTypeResults: Array<{ local_id: string; channex_id: string; name: string; status: string }> = [];
const ratePlanResults: Array<{ local_id: string; channex_id: string; name: string; status: string }> = [];

// Process room types (collect errors, continue on failure)
for (const roomType of roomTypeGroups) {
  try {
    // ... sync logic
    roomTypeResults.push({ ...result, status: 'created' });
  } catch (error) {
    errors.push({ entity: 'room_type', local_id: roomType.unitId, name: roomType.displayName, error: error.message });
  }
}

// Process rate plans (collect errors, continue on failure)
for (const ratePlan of ratePlans) {
  try {
    // ... sync logic
    ratePlanResults.push({ ...result, status: 'created' });
  } catch (error) {
    errors.push({ entity: 'rate_plan', local_id: ratePlan.id, name: ratePlan.name, error: error.message });
  }
}
```

#### 6. Detailed Logging

Each step includes comprehensive logging:

```typescript
console.log(`[Sync] Starting full property sync for: ${property_id}`);
console.log(`[Property] Checking existing mapping...`);
console.log(`[Property] ${existingMapping ? 'Using existing' : 'Creating new'} Channex property`);
console.log(`[RoomTypes] Found ${Object.keys(roomTypeGroups).length} unique room types to sync`);
console.log(`[RoomTypes] Processing: ${roomType.displayName}`);
console.log(`[RoomTypes] Already synced: ${roomType.displayName} -> ${existingMapping.channex_id}`);
console.log(`[RoomTypes] Created: ${roomType.displayName} -> ${channexId}`);
console.log(`[RatePlans] Found ${ratePlans.length} rate plans to sync`);
console.log(`[RatePlans] Processing: ${ratePlan.name}`);
console.log(`[RatePlans] Matched room type: ${matchedRoomType} -> ${channexRoomTypeId}`);
console.log(`[Sync] Complete. Property: ${propertyResult.status}, Room Types: ${roomTypeResults.length}, Rate Plans: ${ratePlanResults.length}, Errors: ${errors.length}`);
```

---

### Database Queries Summary

| Query | Purpose |
|-------|---------|
| `channex_mappings` WHERE `local_id = property_id` AND `entity_type = 'property'` | Check if property already synced |
| `units` WHERE `location = 'ICONIA'` | Get all room types for the property |
| `channex_mappings` WHERE `entity_type = 'room_type'` | Check each room type's sync status |
| `rate_plans` | Get all rate plans |
| `channex_mappings` WHERE `local_id = rate_plan_id` AND `entity_type = 'rate_plan'` | Check each rate plan's sync status |
| `rate_plan_prices` WHERE `rate_plan_id` | Get occupancy for rate plan |

---

### Config Update

Add to `supabase/config.toml`:

```toml
[functions.channex-sync-property]
verify_jwt = false
```

---

### Function Structure

The edge function follows the established pattern:

1. **CORS handling** - Standard preflight response
2. **Method validation** - POST only
3. **Authentication** - Validate Authorization header with user token
4. **Admin check** - Query `user_roles` for admin role
5. **Input validation** - Require property_id
6. **Property sync** - Check/create property in Channex
7. **Room types sync** - Loop through grouped room types, create each in Channex
8. **Rate plans sync** - Loop through rate plans, create each in Channex
9. **Collect results** - Aggregate all successes and errors
10. **Log sync** - Use shared `logSync()` utility for overall operation
11. **Response** - Return complete summary

---

### Summary

| Item | Details |
|------|---------|
| New function | `supabase/functions/channex-sync-property/index.ts` |
| Config update | Add `[functions.channex-sync-property]` entry |
| Error handling | Continue on failure, collect all errors |
| Logging | Detailed step-by-step console logging |
| Response format | Summary with property, room_types, rate_plans, and errors arrays |

