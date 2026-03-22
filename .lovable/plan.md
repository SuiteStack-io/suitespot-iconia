

## Add Debug Logging to Channex Edge Functions (#8 & #9)

### Changes

**1. `supabase/functions/channex-sync-property/index.ts`**
- After line 238 (where `propertyId` is validated), add:
  ```
  console.log('[SyncProperty] Using property_id:', propertyId);
  ```
- After line 240 (after units query returns), add:
  ```
  console.log('[SyncProperty] Units found:', units?.length, units?.map(u => ({ id: u.id, name: u.booking_com_name || u.name })));
  ```
- After line 320 (after rate plans query returns), add:
  ```
  console.log('[SyncProperty] Rate plans found:', ratePlans?.length, ratePlans?.map(rp => ({ id: rp.id, name: rp.name, room_type: rp.room_type })));
  ```

**2. `supabase/functions/channex-create-derived-rate-plan/index.ts`**
- After line 146 (where `ratePlan.property_id` is used to filter), add:
  ```
  console.log('[DerivedRP] Using property_id from rate plan:', ratePlan.property_id);
  ```
- After line 148 (after roomTypeUnit query), add:
  ```
  console.log('[DerivedRP] Room type unit found:', roomTypeUnit);
  ```

Both functions will be redeployed after the changes.

