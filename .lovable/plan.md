

## Fix Availability Sync — Property Scoping Bug

### Root Cause

The **full-sync** (`channex-full-sync`) logic is actually correct — it already counts all units by `booking_com_name` + `property_id` at lines 109-114 and calculates day-by-day availability minus reservations and blocked dates. With 10 cloned units and no reservations, it would push `availability: 10`.

The **real bug** is in `channex-process-sync-queue`'s `calculateAvailability` helper (lines 461-507). This function is called by the automated sync (triggered when reservations/blocked dates change, and also by the "Sync to Channex" button on the Availability page). It queries units by `booking_com_name` but **does not filter by `property_id`**. This means:

1. Unit counts could be wrong if two properties share a room type name (e.g., "Double Room")
2. Reservation/blocked date lookups could match units from the wrong property

This is the function that runs when the user clicks "Save Changes" in the Bulk Availability Editor or when reservations trigger automated syncs.

### Changes

**File: `supabase/functions/channex-process-sync-queue/index.ts`**

1. Update `calculateAvailability` to accept `propertyId` parameter and scope all queries by it:
   - Add `.eq("property_id", propertyId)` to unit count query (line 470)
   - Add `.eq("property_id", propertyId)` to reservation subquery (line 487)
   - Add `.eq("property_id", propertyId)` to blocked dates subquery (line 500)

2. Update all callers of `calculateAvailability` (line 126-131) to pass `unitData.property_id`

**File: `supabase/functions/channex-full-sync/index.ts`**

No changes needed — this function already correctly scopes by `property_id` at line 113.

### Technical Detail

```text
// Before (process-sync-queue, line 468-472)
.eq("booking_com_name", roomTypeName)
.neq("status", "maintenance")

// After
.eq("booking_com_name", roomTypeName)
.eq("property_id", propertyId)
.neq("status", "maintenance")
```

Same pattern applied to the reservation and blocked_dates subqueries within `calculateAvailability`.

