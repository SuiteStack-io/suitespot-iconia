

## Fix: channex_bookings Foreign Key Violation on property_id

### Root Cause

The `channex_bookings.property_id` column has a foreign key constraint referencing `units(id)`. But the webhook stores a **property mapping** `local_id` from `channex_mappings`, which is a property-level concept -- not a unit. The property `local_id` (`e30ad118-...`) doesn't exist in the `units` table, so the insert fails.

This is the exact same issue we just fixed on `channex_sync_logs`.

### Fix

**Database migration**: Drop the broken FK constraint.

```sql
ALTER TABLE channex_bookings DROP CONSTRAINT channex_bookings_property_id_fkey;
```

The `property_id` column is already nullable (confirmed from schema query), so no other schema change is needed. The webhook code itself is already correct -- it looks up the local property ID from `channex_mappings` and passes it. The only problem is the FK constraint rejecting that ID because it doesn't exist in `units`.

### No Edge Function Changes Needed

The webhook code at lines 125-142 already:
- Extracts the Channex property ID from the payload
- Looks it up in `channex_mappings` to get the `local_id`
- Falls back to `null` if not found
- Passes the resolved `localPropertyId` to the booking record

This is all correct. The only blocker is the FK constraint.

### Summary

| Change | Detail |
|--------|--------|
| Drop FK constraint | `channex_bookings_property_id_fkey` (references `units(id)`) |
| Code changes | None needed |

