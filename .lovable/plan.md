

## Fix: Auto-Shuffle Blocked by Overlap Trigger

### Root Cause
The BFS algorithm correctly computes a valid chain of moves, but executes them **sequentially**. A database trigger (`prevent_reservation_overlap`) fires on each individual UPDATE and blocks moves where the destination unit still has a conflicting reservation that hasn't been moved yet (it's scheduled to move later in the chain).

Example: BFS says "move A from 501→502, then move B from 502→503". When move A executes, B is still on 502, so the trigger raises `RESERVATION CONFLICT`.

### Fix
Update the `prevent_reservation_overlap()` trigger function to **skip validation when the update is a shuffle operation**. The shuffle code already sets `shuffled_from_unit_id` on the reservation during moves — we use this as the signal.

### Database Migration
```sql
CREATE OR REPLACE FUNCTION public.prevent_reservation_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  conflict_record RECORD;
  unit_info RECORD;
BEGIN
  -- Skip validation for shuffle moves (BFS algorithm pre-validates)
  IF NEW.shuffled_from_unit_id IS NOT NULL 
     AND (OLD.shuffled_from_unit_id IS NULL OR NEW.shuffled_from_unit_id != OLD.shuffled_from_unit_id) THEN
    RETURN NEW;
  END IF;

  -- Only check for confirmed or checked-in reservations
  IF NEW.status NOT IN ('confirmed', 'checked-in') THEN
    RETURN NEW;
  END IF;

  -- existing conflict check logic unchanged...
END;
$function$;
```

The condition `NEW.shuffled_from_unit_id IS NOT NULL AND (OLD value differs)` ensures:
- Shuffle moves bypass the trigger (trusted, pre-validated by BFS)
- Normal inserts/updates still get full conflict checking
- Re-saving a previously shuffled reservation doesn't skip validation

### Files
- Single database migration only. No application code changes needed.

