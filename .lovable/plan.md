# Defense-in-Depth: Block Reservation UPDATEs Into Blocked Units

## Goal
Add a database-level BEFORE UPDATE trigger on `public.reservations` that rejects any UPDATE which would assign the reservation to a unit/date range overlapping a row in `public.blocked_dates`. This is the first of three prompts to close the validation gap exposed by the Irina Botros incident (Apr 25, 2026), where Room #512 was reachable via a frontend path that skipped the blocked-dates check.

## Verified Schema
- `public.blocked_dates` columns: `id, unit_id, blocked_date (date), reason, created_at, created_by` — confirmed.
- `public.units` has both `unit_number` and `name` (text) — safe to use `COALESCE(unit_number, name, id::text)` for the error message.
- Existing trigger `prevent_reservation_overlap` (function `check_reservation_overlap`) stays untouched — the new trigger is independent.

## Database Migration

Single migration containing the function + trigger.

### 1. Trigger function `check_reservation_against_blocked_dates`
- `BEFORE UPDATE`, `SECURITY DEFINER`, `search_path = public`.
- Early-returns when none of `unit_id`, `check_in_date`, `check_out_date` actually changed (uses `IS NOT DISTINCT FROM` so NULLs compare safely).
- Early-returns when `NEW.unit_id IS NULL` (unassigned reservation — nothing to validate against blocks).
- Aggregates the conflict count, earliest blocked date, and that row's reason in a single scan plus one correlated subquery for the reason (matches the prompt's spec exactly).
- On conflict, looks up a friendly unit label from `public.units` and `RAISE EXCEPTION` with `ERRCODE = 'check_violation'` so the frontend can recognize it.
- Returns `NEW` on the clean path.

### 2. Trigger
```sql
DROP TRIGGER IF EXISTS prevent_reservation_blocked_dates ON public.reservations;
CREATE TRIGGER prevent_reservation_blocked_dates
BEFORE UPDATE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.check_reservation_against_blocked_dates();
```

### 3. Function body (final SQL — exactly what gets migrated)
```sql
CREATE OR REPLACE FUNCTION public.check_reservation_against_blocked_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conflict_count integer;
  first_blocked_date date;
  first_blocked_reason text;
  unit_label text;
BEGIN
  IF (NEW.unit_id IS NOT DISTINCT FROM OLD.unit_id)
     AND (NEW.check_in_date IS NOT DISTINCT FROM OLD.check_in_date)
     AND (NEW.check_out_date IS NOT DISTINCT FROM OLD.check_out_date) THEN
    RETURN NEW;
  END IF;

  IF NEW.unit_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*), MIN(blocked_date), (
    SELECT reason FROM public.blocked_dates
    WHERE unit_id = NEW.unit_id
      AND blocked_date >= NEW.check_in_date
      AND blocked_date < NEW.check_out_date
    ORDER BY blocked_date ASC LIMIT 1
  )
  INTO conflict_count, first_blocked_date, first_blocked_reason
  FROM public.blocked_dates
  WHERE unit_id = NEW.unit_id
    AND blocked_date >= NEW.check_in_date
    AND blocked_date < NEW.check_out_date;

  IF conflict_count > 0 THEN
    SELECT COALESCE(unit_number, name, NEW.unit_id::text) INTO unit_label
    FROM public.units WHERE id = NEW.unit_id;

    RAISE EXCEPTION
      'Cannot assign reservation to unit %: % blocked date(s) found in [%, %). First blocked date: % (reason: %)',
      unit_label,
      conflict_count,
      NEW.check_in_date,
      NEW.check_out_date,
      first_blocked_date,
      COALESCE(first_blocked_reason, 'no reason given')
    USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
```

## Verification (run after migration applies)
```sql
SELECT proname, prosecdef FROM pg_proc
WHERE proname = 'check_reservation_against_blocked_dates';

SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'reservations'
  AND trigger_name = 'prevent_reservation_blocked_dates';
```
Both should return one row each.

## Out of Scope (per prompt)
- INSERT-time validation (future prompt if needed).
- Any frontend changes (handled in Prompts 2 & 3).
- Any change to `prevent_reservation_overlap`, `check_and_lock_unit_availability`, `blocked_dates` schema, Channex notify triggers, or edge functions.
- No retroactive cleanup of existing reservations that already violate blocks.

## Rollback
```sql
DROP TRIGGER IF EXISTS prevent_reservation_blocked_dates ON public.reservations;
DROP FUNCTION IF EXISTS public.check_reservation_against_blocked_dates();
```

## Risk Notes
- Edge functions that legitimately move reservations (auto-shuffle, auto-assign) already validate via `check_and_lock_unit_availability`, so they will not trip this trigger under normal flow.
- The trigger only fires when unit/dates change, so unrelated UPDATEs (status changes, guest edits, pricing) are unaffected.
- Error code `check_violation` is distinct from the existing overlap trigger's error, so frontends can show a tailored message in Prompt 2.
