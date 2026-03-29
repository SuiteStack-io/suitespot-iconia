

## Part 1: Add Auto-Shuffle Fallback to `auto-assign-rooms`

**File**: `supabase/functions/auto-assign-rooms/index.ts`

At lines 300-309, where a reservation can't be directly assigned (the `else` branch), instead of immediately pushing to `conflicts`, call the `auto-shuffle-rooms` edge function:

```ts
} else {
  // Try auto-shuffle before giving up
  console.log(`[auto-assign-rooms] No direct room available for ${res.id}, attempting auto-shuffle...`);
  try {
    const shuffleResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/auto-shuffle-rooms`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          roomType: roomTypeName,
          checkInDate: res.check_in_date,
          checkOutDate: res.check_out_date,
          bookingReference: res.booking_reference,
          guestNames: res.guest_names || [],
          triggerSource: "allocate-unit",
          propertyId: propertyId,
        }),
      }
    );
    const shuffleResult = await shuffleResponse.json();
    
    if (shuffleResult.success && shuffleResult.freedUnitId) {
      // Shuffle freed a room — assign it
      const freedUnit = candidateUnits.find(u => u.id === shuffleResult.freedUnitId);
      assigned.push({
        reservation_id: res.id,
        room_id: shuffleResult.freedUnitId,
        room_number: freedUnit?.unit_number || freedUnit?.name || "shuffled",
      });
      occupancyMap.get(shuffleResult.freedUnitId)?.push({
        check_in: res.check_in_date,
        check_out: res.check_out_date,
      });
      console.log(`[auto-assign-rooms] Shuffle resolved: ${res.id} → ${shuffleResult.freedUnitId}`);
    } else {
      // Shuffle also failed
      conflicts.push({
        reservation_id: res.id,
        guest_name: res.guest_names?.[0] || "Unknown",
        check_in: res.check_in_date,
        check_out: res.check_out_date,
        reason: `No available room of type "${roomTypeName}" for the requested dates. Auto-shuffle also failed to resolve.`,
      });
    }
  } catch (shuffleErr: any) {
    console.error(`[auto-assign-rooms] Shuffle call failed:`, shuffleErr.message);
    conflicts.push({
      reservation_id: res.id,
      guest_name: res.guest_names?.[0] || "Unknown",
      check_in: res.check_in_date,
      check_out: res.check_out_date,
      reason: `No available room of type "${roomTypeName}". Auto-shuffle error: ${shuffleErr.message}`,
    });
  }
}
```

## Part 2: Data Fix — Move Erik Steckler to Room 505

Run via insert tool (data update, not schema):

```sql
UPDATE reservations 
SET unit_id = '2bc6b36a-10a5-4064-923e-2e7d16bac2f6',
    shuffled_from_unit_id = '2bc6b36a-10a5-4064-923e-2e7d16bac2f6'
WHERE id = '85c2a696-aa0d-4d81-9a45-883f358a585b';
```

And log the move:

```sql
INSERT INTO room_shuffle_log (shuffle_date, triggered_by_reference, room_type, moves, move_count, reason, property_id)
VALUES (
  NOW(),
  '85c2a696-aa0d-4d81-9a45-883f358a585b',
  'Suite with Terrace',
  '[{"guest_name":"Erik Steckler","from_room_number":"502","to_room_number":"505","reservation_id":"85c2a696-aa0d-4d81-9a45-883f358a585b","check_in":"2026-04-04","check_out":"2026-04-06"}]'::jsonb,
  1,
  'Manual fix: resolved double booking conflict on Room 502',
  (SELECT property_id FROM reservations WHERE id = '85c2a696-aa0d-4d81-9a45-883f358a585b')
);
```

### Files Modified
1. `supabase/functions/auto-assign-rooms/index.ts` — replace conflict-only else branch with shuffle-then-conflict fallback
2. Database — 2 data operations via insert tool

