## Convert BlockedDatesManager to Staged Apply → Save Changes (Apply-time room-type expansion)

### Audit (unchanged from prior plan)

| # | File:Line | Op | Direct Channex push after change? |
|---|---|---|---|
| 1 | `BlockedDatesManager.tsx:282` | INSERT (Block button) | Replaced by staged Apply → Save |
| 2 | `BlockedDatesManager.tsx:317` | DELETE single group | Yes |
| 3 | `BlockedDatesManager.tsx:339` | DELETE bulk | Yes |
| 4 | `BlockedDatesManager.tsx:417 + 436` | DELETE + INSERT (edit dialog) | Yes (covers union of old+new range/room type) |
| 5 | `BlockedDatesManager.tsx:452` | UPDATE reason only | No (trigger doesn't fire on UPDATE) |
| 6 | `useLateCheckout.ts:39` | INSERT | Yes |
| 7 | `useLateCheckout.ts:138` | DELETE | Yes |

### Files to create / change

#### NEW — `src/lib/availability-calculator.ts`

Client-side helper, separate copy of the algorithm in `supabase/functions/channex-process-sync-queue/index.ts` lines 456–552. Two exports:

```ts
export interface AvailabilityRange {
  date_from: string; // inclusive YYYY-MM-DD
  date_to: string;   // inclusive YYYY-MM-DD
  availability: number;
}

export async function calculateAvailabilityRanges(
  roomTypeName: string,
  dateFrom: string,    // inclusive
  dateTo: string,      // exclusive (matches edge-function query semantics)
  propertyId: string,
): Promise<AvailabilityRange[]>;

export async function getRoomTypePrimaryUnitId(
  roomTypeName: string,
  propertyId: string,
): Promise<string | null>;
```

Verbatim port of the edge-function logic: count units (`property_id = X AND booking_com_name = Y AND status != 'maintenance'`), pull overlapping reservations + blocked rows in the half-open `[dateFrom, dateTo)` range, walk day-by-day building `occupiedUnits` (reservations where `check_in_date <= ds AND check_out_date > ds`) then `blockedUnits` (skip units already occupied), then collapse consecutive equal-availability days into ranges.

Intentionally a separate copy — not shared with the edge function.

#### `src/components/BlockedDatesManager.tsx` — Apply-time expansion + staged pattern + delete-side sync

**New PendingBlockedDate shape:**
```ts
interface PendingBlockedDate {
  id: string;                  // crypto.randomUUID()
  roomTypeName: string;        // booking_com_name shared by all unitIds
  unitIds: string[];           // never null, never empty, all share roomTypeName
  unitLabels: string[];        // for display ("3 of 5 units" computed from this)
  totalUnitsInRoomType: number;// for "X of Y units" display
  dateFrom: string;            // yyyy-MM-dd
  dateTo: string;              // yyyy-MM-dd
  datesInRange: string[];      // yyyy-MM-dd
  reason: string | null;
  addedAt: Date;
}
const [pendingBlockedDates, setPendingBlockedDates] = useState<PendingBlockedDate[]>([]);
const [savingChanges, setSavingChanges] = useState(false);
```

**`handleApply`** (renames + replaces `handleAddBlockedDate`, NO DB writes):

1. Validate (date range + ≥1 selection).
2. Resolve target units, expanding "all rooms" up-front:
   ```ts
   // Always pull the canonical unit set the way calculateAvailabilityRanges will.
   const { data: allPropertyUnits } = await supabase
     .from('units')
     .select('id, booking_com_name')
     .eq('property_id', propertyId)
     .neq('status', 'maintenance');
   ```
   - If `selectedUnitIds.includes('all')`: target = every row from `allPropertyUnits` that has a non-null `booking_com_name`. Skip rows with null `booking_com_name` and warn in console (same behaviour as the edge function, which keys everything off `booking_com_name`).
   - Else: target = the subset of `allPropertyUnits` whose `id` is in `selectedUnitIds`.
3. Group target units by `booking_com_name`. For each group, build one `PendingBlockedDate`:
   - `roomTypeName` = the booking_com_name
   - `unitIds` = ids in that group
   - `totalUnitsInRoomType` = count of all `allPropertyUnits` rows with this same `booking_com_name` (so display can say "2 of 5 units")
   - `unitLabels` = the user-friendly unit names from the existing `units` state, looked up by id (used in optional expanded view; primary display uses room type name + count)
   - shared `dateFrom`/`dateTo`/`datesInRange`/`reason`
   - fresh `crypto.randomUUID()` per entry
4. `setPendingBlockedDates(prev => [...prev, ...expanded])` in one call.
5. Reset form, close dialog, toast `"${expanded.length} room type(s) added to pending changes for ${datesInRange.length} date(s)"`.

**`handleRemovePending(id)`** — drop one pending row.

**`handleSaveAllChanges`** — straight loop, no special cases:
1. Build `insertRecords` by flat-mapping every pending: for each `unitId` in `pending.unitIds`, for each `date` in `pending.datesInRange`, push `{ blocked_date, unit_id, reason }`. No null `unit_id` ever.
2. `await supabase.from('blocked_dates').insert(insertRecords)`. Single batch. On 23505 → "Some dates already blocked"; keep pending state.
3. Build Channex `updates[]`:
   - Optionally merge pendings sharing `(roomTypeName, dateFrom, dateTo)` to avoid recomputing the same range twice — but never merge across different room types or different ranges.
   - For each unique `(roomTypeName, dateFrom, dateTo)`:
     ```ts
     const exclusiveTo = format(addDays(parseISO(dateTo), 1), 'yyyy-MM-dd');
     const ranges = await calculateAvailabilityRanges(roomTypeName, dateFrom, exclusiveTo, propertyId);
     const primaryUnitId = await getRoomTypePrimaryUnitId(roomTypeName, propertyId);
     if (!primaryUnitId) continue; // no Channex mapping possible
     for (const r of ranges) {
       updates.push({
         property_id: propertyId,
         room_type_id: primaryUnitId,
         date_from: r.date_from,
         date_to: r.date_to,
         availability: r.availability,
       });
     }
     ```
4. Single call `await supabase.functions.invoke('channex-push-availability', { body: { updates } })`. Same payload shape used by `BulkAvailabilityEditor` lines 241–251.
5. On success: clear `pendingBlockedDates`, toast `"X date(s) blocked across N room type(s) and synced to Channex"`, `fetchBlockedDates()`.
6. On error: keep pending state intact; error toast.

**Delete + edit handlers** — must push directly now that the trigger is gone. Existing rows may have `unit_id = null` (legacy "all rooms" data); preserve the existing handling and resolve affected room types from `group.units?.booking_com_name` when present, otherwise fall back to "every room type at the property" for the affected date range:

- `handleDeleteGroup(group)`: after `delete().in("id", group.ids)`, compute affected `(roomTypeName, dateFrom, dateTo)` from the group, run `calculateAvailabilityRanges` per room type, push once.
- `handleBulkDelete()`: same idea, but group affected rows by room type before iterating; one push for all.
- `handleUpdateBlockedDates()` (edit): after delete + re-insert (or reason-only update), push covering the union of old date range + new date range AND old room type + new room type.

**Pending Changes UI** — rendered above the filter bar inside `<CardContent>`, only when `pendingBlockedDates.length > 0`:
```
┌──────────────────────────────────────────────────────────────┐
│ Pending Changes (5)                       [Save Changes →]   │
│  • Suite with Terrace · 3 of 3 units · Apr 25 – May 2 · …  X │
│  • Deluxe Suite       · 1 of 2 units · Apr 25 – May 2 · …  X │
│  …                                                           │
└──────────────────────────────────────────────────────────────┘
```
Submit button text "Block Dates" → "Apply".

#### `src/hooks/useLateCheckout.ts` — direct Channex push

After the insert (line 47) and after the delete (line 143), add a non-blocking try/catch (mirroring the existing notification pattern at lines 110–119):
```ts
try {
  const { data: unit } = await supabase
    .from('units')
    .select('booking_com_name, property_id')
    .eq('id', unitId)
    .single();
  if (unit?.booking_com_name && unit.property_id) {
    const exclusiveTo = format(addDays(parseISO(checkoutDate), 1), 'yyyy-MM-dd');
    const ranges = await calculateAvailabilityRanges(
      unit.booking_com_name, checkoutDate, exclusiveTo, unit.property_id,
    );
    const primaryUnitId = await getRoomTypePrimaryUnitId(unit.booking_com_name, unit.property_id);
    if (primaryUnitId && ranges.length > 0) {
      const updates = ranges.map(r => ({
        property_id: unit.property_id,
        room_type_id: primaryUnitId,
        date_from: r.date_from,
        date_to: r.date_to,
        availability: r.availability,
      }));
      await supabase.functions.invoke('channex-push-availability', { body: { updates } });
    }
  }
} catch (e) {
  console.error('Failed to sync availability to Channex after late-checkout change:', e);
}
```
Late checkout is always single-unit, single-day — no "all rooms" path involved.

#### MIGRATION — drop the trigger

```sql
-- Drop per-row trigger that fans out duplicate Channex calls.
-- Manual blocked_date writes (BlockedDatesManager + useLateCheckout) now push
-- to Channex directly via channex-push-availability.
-- Function notify_channex_blocked_dates_change() is intentionally KEPT so the
-- trigger can be recreated later if needed.
DROP TRIGGER IF EXISTS on_blocked_dates_change_channex ON public.blocked_dates;
```

### Untouched
`BulkAvailabilityEditor`, `BulkRestrictionEditor`, `channex-push-availability`, `channex-process-sync-queue`, `channex_sync_queue` table, `notify_channex_blocked_dates_change()` function, all reservation-driven sync paths.

### Acceptance criteria
1. User clicks "all rooms" + Apply on a property with 5 room types → pending panel shows **5 rows** (one per room type), not 1. Each row shows "X of Y units · date range · reason".
2. User can remove individual room types from the pending list before saving.
3. `handleSaveAllChanges` contains no `if (unit_id === null)` and no "expand all rooms" branch — it just loops `pendingBlockedDates` uniformly.
4. Blocking 7 consecutive days via Save Changes → exactly **one** invocation of `channex-push-availability` with range-collapsed `updates[]`.
5. Late-checkout apply/remove → one Channex push per call.
6. Single delete, bulk delete, and edit-dialog save → one push covering all affected room types and the union of old+new date ranges.
7. No `channex_sync_queue` rows produced by manual blocks anymore.
8. No duplicate variable declarations in any modified file.
