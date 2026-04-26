## Migration Plan: Add `change_type` to `room_shuffle_log`

This is Prompt 2 of 5 for the Manual Room Change History + Undo feature. Schema-only change. No application code modified.

### Migration SQL

```sql
-- 1. Add the column with default + check constraint (covers all existing rows)
ALTER TABLE public.room_shuffle_log
ADD COLUMN change_type text NOT NULL DEFAULT 'automatic'
CHECK (change_type IN ('automatic', 'manual'));

-- 2. Backfill the lone hand-inserted manual row(s)
UPDATE public.room_shuffle_log
SET change_type = 'manual'
WHERE reason LIKE 'Manual fix:%';

-- 3. Index to support filtering on the Shuffle History page (Prompt 4)
CREATE INDEX idx_room_shuffle_log_change_type
ON public.room_shuffle_log (change_type);
```

### Verification (run after migration, report results)

```sql
-- Column shape
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'room_shuffle_log'
  AND column_name = 'change_type';

-- Distribution
SELECT change_type, COUNT(*)
FROM public.room_shuffle_log
GROUP BY change_type
ORDER BY change_type;

-- The manual row(s)
SELECT id, change_type, reason, created_at
FROM public.room_shuffle_log
WHERE change_type = 'manual';
```

### Out of scope (intentionally untouched)

- Edge functions `auto-shuffle-rooms` / `auto-assign-rooms` — new rows inherit `'automatic'` from the column default
- Frontend (`AvailabilityCalendar.tsx`, `ReservationDetail.tsx`, `RoomSwapDialog.tsx`, `ShuffleHistory.tsx`)
- Existing columns (no drops, no renames, no `triggered_by_booking_id` backfill)
- TypeScript types regenerate automatically after the migration

### Notes

- `NOT NULL DEFAULT 'automatic'` populates every existing row in the `ALTER` itself — no separate bulk UPDATE needed.
- The `WHERE reason LIKE 'Manual fix:%'` UPDATE is defensive: 0 matches = no-op, >1 match = all flipped correctly.
- `CHECK` constraint on a static enum is safe (immutable), no validation trigger needed.
