

## Fix Room Shuffle Email Subject Line

### Problem
The subject line currently shows the **triggering** booking's guest name and reference:
`Room Shuffle Alert - Emna Haj Romdhane (5765450047) at ICONIA Zamalek...`

It should show the **moved** guest's name and room change:
`Room Shuffle Alert - Anton Yang - Room #505 to #502 at ICONIA Zamalek...`

### Fix
**File: `supabase/functions/auto-shuffle-rooms/index.ts`** — line 581

Replace:
```ts
subject: `Room Shuffle Alert - ${guestNames[0] || 'Guest'} (${bookingReference}) at ${shufflePropertyName}`,
```

With:
```ts
subject: `Room Shuffle Alert - ${solution.moves[0]?.guest_name || guestNames[0] || 'Guest'} - Room #${solution.moves[0]?.from_room_number} to #${solution.moves[0]?.to_room_number} at ${shufflePropertyName}`,
```

This uses the first move's guest name, from-room, and to-room in the subject. If there are multiple moves, the first move is shown (the email body already contains all move details).

### Files Modified
- `supabase/functions/auto-shuffle-rooms/index.ts` (single line change)

