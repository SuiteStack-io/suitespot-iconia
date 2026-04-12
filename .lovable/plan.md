

## Fix: Update Existing Room Types on Channex Sync

### Problem
Lines 273-276 of `channex-sync-property/index.ts` skip already-synced room types with `continue`, never pushing updated occupancy values to Channex. This caused Booking.com to accept over-capacity bookings.

### Changes — 1 File

**File: `supabase/functions/channex-sync-property/index.ts`**

Replace the `if (existing) { continue; }` block (lines 273-276) with a PUT update:

```typescript
if (existing) {
  // UPDATE existing room type with current values
  const updatePayload = {
    room_type: {
      title: displayName,
      count_of_rooms: rt.count,
      occ_adults: rt.max_guests,
      occ_children: rt.max_children,
      occ_infants: rt.max_infants,
      default_occupancy: rt.default_occupancy,
      kind: rt.room_kind,
    }
  };

  try {
    const updateRes = await channexRequest<{ data: { id: string } }>(
      'PUT',
      `/api/v1/room_types/${existing.channex_id}`,
      updatePayload
    );
    console.log(`[RoomTypes] Updated: ${displayName} -> ${existing.channex_id}`);

    // Update mapping with latest data
    await supabaseAdmin.from('channex_mappings').update({
      last_synced_at: new Date().toISOString(),
      channex_data: updateRes.data,
    }).eq('local_id', rt.unitId).eq('entity_type', 'room_type');

    roomTypeResults.push({
      local_id: rt.unitId,
      channex_id: existing.channex_id,
      name: displayName,
      status: 'updated',
    });

    await logSync(
      'channex-sync-property',
      `PUT /api/v1/room_types/${existing.channex_id}`,
      updatePayload, updateRes, 200, true, null, propConfig.id
    );
  } catch (updateErr) {
    const msg = updateErr instanceof Error ? updateErr.message : String(updateErr);
    console.error(`[RoomTypes] Update failed for ${displayName}:`, msg);
    errors.push({ entity: 'room_type', local_id: rt.unitId, name: displayName, error: msg });
    // Still record it so rate plan linking works
    roomTypeResults.push({
      local_id: rt.unitId,
      channex_id: existing.channex_id,
      name: displayName,
      status: 'update_failed',
    });
    await logSync(
      'channex-sync-property',
      `PUT /api/v1/room_types/${existing.channex_id}`,
      updatePayload, null, 500, false, msg, propConfig.id
    );
  }
  continue;
}
```

### What This Does
- Every sync click now sends a PUT to Channex for each existing room type with current `occ_adults`, `occ_children`, `occ_infants`, `default_occupancy`, `count_of_rooms`, and `kind`
- Each update is logged in `channex_sync_logs` with the full payload
- `channex_mappings` is updated with latest sync timestamp and response data
- New room type creation (POST) is unchanged
- Rate plan sync, availability sync, and all other logic is unchanged

### After Deployment
Click "Sync to Channex" on the property card to push corrected occupancy values for all room types (Junior Suite: 3, Deluxe Suite: 3, Family Suite: 5, etc.).

