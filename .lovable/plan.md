

## Fix: Auto-Shuffle BFS Missing Checked-In Reservations as Blockers + Execute 2-Move Chain Swap

### Root Cause

**Line 93** of `auto-shuffle-rooms/index.ts` only queries reservations with `status IN ('confirmed', 'pending_assignment')`. This means:
- Checked-in guests (like Alejandro Quiros Apr 3-6, Tyler Martin Apr 6-7 on Room 502) are **invisible** to the BFS
- The BFS thinks Room 502 only has Ghaidaa (Apr 9 - May 8) and tries to move Sandrine there, not knowing the room is blocked by checked-in/completed guests
- Line 209 (`if (res.status === 'checked-in') continue`) correctly prevents moving checked-in guests, but they must be **loaded first** to act as immovable blockers

### Fix — 1 File, Then Execute Chain Swap

**File: `supabase/functions/auto-shuffle-rooms/index.ts`**

#### Change 1: Include checked-in reservations in query (line 93)
```typescript
// Before:
.in('status', ['confirmed', 'pending_assignment'])

// After:
.in('status', ['confirmed', 'pending_assignment', 'checked-in'])
```

This loads checked-in guests as room blockers. Line 209 already prevents them from being moved.

#### Change 2: Add diagnostic logging after data fetch (~line 106)
After `const reservations: ReservationInfo[] = allReservations || [];`, add:
```typescript
console.log('[AutoShuffle] Loaded reservations:', reservations.length);
for (const unit of units) {
  const onUnit = reservations.filter(r => r.unit_id === unit.id);
  console.log(`[AutoShuffle] Room ${unit.unit_number}: ${onUnit.map(r => `${r.guest_names?.[0] || 'Unknown'} (${r.check_in_date}→${r.check_out_date}, ${r.status})`).join(', ') || 'empty'}`);
}
```

#### Change 3: Add BFS trace logging (inside the BFS loop, after line 223)
After `if (!targetFree) continue;`, add:
```typescript
console.log(`[AutoShuffle] BFS: ${res.guest_names?.[0]} ${unitMap.get(currentUnitId)?.unit_number}→${targetUnit.unit_number} (${res.check_in_date}→${res.check_out_date}): fits`);
```

And when a solution is found (after line 195 `if (unitFree)`), add:
```typescript
console.log(`[AutoShuffle] SOLUTION: Unit ${unit.unit_number} freed after ${current.moves.length} moves`);
```

### Post-Fix: Execute 2-Move Chain Swap for Andrew Tadros

After deploying the updated edge function, invoke `auto-assign-rooms` with `reservation_ids: ["bf0d9807-613c-471e-b62c-c5b07cfa532c"]`. With checked-in guests now visible as blockers, the BFS should find the correct 2-move chain:

1. Ghaidaa Alkhdour (Apr 9 - May 8): Room 502 → Room 505
2. Natasja Scholten (Apr 12 - Apr 18): Room 505 → Room 502
3. Andrew Tadros assigned to Room 502

### Summary
- 1 edge function edited: add `checked-in` to reservation query + BFS trace logging
- 1 re-run of auto-assign for Tadros after deploy
- No changes to the BFS algorithm structure, email templates, calendar UI, or manual booking flow

