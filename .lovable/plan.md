## Convert BlockedDatesManager to Staged Apply → Save Changes (Apply-time room-type expansion)

### Audit (writers to `blocked_dates`)

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

Verbatim port: count units (`property_id = X AND booking_com_name = Y AND status != 'maintenance'`), pull overlapping reservations + blocked rows in half-open `[dateFrom, dateTo)`, walk day-by-day building `occupiedUnits` (reservations with `check_in_date <= ds AND check_out_date > ds`), then `blockedUnits` (skip units already occupied), then collapse consecutive equal-availability days into ranges. Intentionally a separate copy — not shared with the edge function.

#### `src/components/BlockedDatesManager.tsx` — Apply-time expansion + staged pattern

**New state shape:**
```ts
interface PendingBlockedDate {
  id: string;                  // crypto.randomUUID()
  roomTypeName: string;        // booking_com_name shared by all unitIds
  unitIds: string[];           // never null, never empty
  unitLabels: string[];        // for optional expanded display
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

**`handleApply`** (replaces `handleAddBlockedDate`, NO DB writes):
1. Validate (date range + ≥1 selection).
2. Pull canonical unit set:
   ```ts
   const { data: allPropertyUnits } = await supabase
     .from('units')
     .select('id, booking_com_name, name, unit_number')
     .eq('property_id', propertyId)
     .neq('status', 'maintenance');
   ```
3. Resolve target units:
   - "all rooms" selected → every row with non-null `booking_com_name`. Skip null `booking_com_name` rows with a console warning.
   - Otherwise → subset whose `id` is in `selectedUnitIds`.
4. Group target units by `booking_com_name`. For each group create one `PendingBlockedDate`:
   - `roomTypeName` = booking_com_name
   - `unitIds` = ids in this group
   - `totalUnitsInRoomType` = total `allPropertyUnits` rows sharing this booking_com_name
   - `unitLabels` = friendly names (`name` / `unit_number`)
   - shared `dateFrom`/`dateTo`/`datesInRange`/`reason`
   - fresh `crypto.randomUUID()` per entry
5. `setPendingBlockedDates(prev => [...prev, ...expanded])` in one call.
6. Reset form + close dialog. Toast: `"${expanded.length} room type(s) added to pending changes for ${datesInRange.length} date(s)"`.

**`handleRemovePending(id)`** — drop one pending row.

**`handleSaveAllChanges`** — straight loop, no special cases:
1. Flat-map every pending → `insertRecords` of `{ blocked_date, unit_id, reason }`. No null `unit_id` ever.
2. Single `await supabase.from('blocked_dates').insert(insertRecords)`. On 23505 → "Some dates already blocked"; keep pending state.
3. Build Channex `updates[]`. Optionally merge pendings sharing `(roomTypeName, dateFrom, dateTo)` so the same range isn't recomputed twice. Never merge across different room types or different ranges. For each unique `(roomTypeName, dateFrom, dateTo)`:
   ```ts
   const exclusiveTo = format(addDays(parseISO(dateTo), 1), 'yyyy-MM-dd');
   const ranges = await calculateAvailabilityRanges(roomTypeName, dateFrom, exclusiveTo, propertyId);
   const primaryUnitId = await getRoomTypePrimaryUnitId(roomTypeName, propertyId);
   if (!primaryUnitId) continue;
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
4. Single `await supabase.functions.invoke('channex-push-availability', { body: { updates } })`.
5. On success: clear `pendingBlockedDates`, toast, `fetchBlockedDates()`. On error: keep pending state intact.

**Delete + edit handlers** — push directly now that the trigger is gone. Existing rows may have `unit_id = null` (legacy data); keep that handling. Resolve affected room types from `group.units?.booking_com_name` when present, else fall back to "every room type at this property" for the affected dates.
- `handleDeleteGroup(group)` → after delete, compute affected `(roomTypeName, dateFrom, dateTo)`, recompute ranges, push once.
- `handleBulkDelete()` → group affected rows by room type; one push for all.
- `handleUpdateBlockedDates()` → push covering union of old date range + new date range AND old room type + new room type.

**Pending Changes UI** above the filter bar:
```
┌──────────────────────────────────────────────────────────────┐
│ Pending Changes (5)                       [Save Changes →]   │
│  • Suite with Terrace · 3 of 3 units · Apr 25 – May 2 · …  X │
│  • Deluxe Suite       · 1 of 2 units · Apr 25 – May 2 · …  X │
└──────────────────────────────────────────────────────────────┘
```
Submit button text changes from "Block Dates" to "Apply".

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
Late checkout is always single-unit, single-day — no "all rooms" path.

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
1. "all rooms" + Apply on a property with 5 room types → pending panel shows **5 rows** (one per room type), not 1. Each row shows "X of Y units · date range · reason".
2. User can remove individual room types from the pending list before saving.
3. `handleSaveAllChanges` contains no `if (unit_id === null)` and no "expand all rooms" branch — uniform loop.
4. Blocking 7 consecutive days via Save Changes → exactly **one** invocation of `channex-push-availability` with range-collapsed `updates[]`.
5. Late-checkout apply/remove → one Channex push per call.
6. Single delete, bulk delete, edit-dialog save → one push covering all affected room types and union of old+new date ranges.
7. No `channex_sync_queue` rows produced by manual blocks anymore.
8. No duplicate variable declarations in any modified file.
