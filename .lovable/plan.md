
Goal: fix `channex-booking-webhook` so a new booking pushes availability for the full occupied stay window (`check_in_date` through `check_out_date - 1 day`), with no skipped boundary days.

Implementation plan:

1) Inspect and harden stay-range source in webhook
- In `channex-booking-webhook/index.ts`, add a small date-range resolver for booking dates.
- Resolve `effectiveCheckIn`/`effectiveCheckOut` from the richest available booking data:
  - Prefer room-level dates when available (`rooms[*].checkin_date` / `rooms[*].checkout_date`, plus common aliases).
  - Fallback to top-level dates (`arrival_date` / `departure_date` aliases).
- Normalize to `YYYY-MM-DD` date-only strings before use.
- Add a guard: if `effectiveCheckOut <= effectiveCheckIn`, skip push and log a clear error.

2) Make the availability loop explicitly boundary-safe
- Keep `pushScopedAvailForRange(dateFrom, dateTo, label)` semantics as:
  - `dateFrom` = inclusive check-in day
  - `dateTo` = exclusive checkout day
- Refactor day iteration to an explicit inclusive occupied range:
  - `lastOccupied = dateTo - 1 day`
  - loop from `dateFrom` to `lastOccupied` inclusive
- This guarantees:
  - first occupied day is included (no `+1` bug),
  - last occupied night is included (no `-1` extra loss).

3) Keep per-day occupancy rule and range grouping unchanged
- For each day, count occupancy with:
  - `check_in_date <= day AND check_out_date > day`
- Compute `availability = totalUnits - occupied`.
- Collapse consecutive equal-availability days into `date_from/date_to` ranges.
- Push all grouped values in one batch payload.

4) Ensure new-booking call path uses full resolved range
- In the “new booking” branch (after reservation create/update), call availability push with the resolved booking window (`effectiveCheckIn`, `effectiveCheckOut`) directly.
- Do not trim boundaries before calling.
- Keep cancellation/modification flows unchanged except using the same normalized range helper for consistency.

5) Add precise diagnostics for verification
- Log computed push window and generated day bounds:
  - start day, last occupied day, day count, and final grouped payload.
- This allows immediate confirmation for the example:
  - 2026-03-22 to 2026-03-30 occupied nights -> grouped payload:
    - 2026-03-22..2026-03-22 (8)
    - 2026-03-23..2026-03-24 (9)
    - 2026-03-25..2026-03-30 (10)

Technical notes:
- No duplicate variable declarations in the same scope (explicitly checked while refactoring helpers and loop variables).
- No changes to recipient logic, triggers, or other sync functions required for this specific bug.
