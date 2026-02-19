

## Make Webhook Resilient to Missing Property Mappings

### Problem
The webhook hard-fails with "Unknown property: test-property-id" because:
1. It returns early when `channex_mappings` has no match for the property ID
2. The `property_id` column in `channex_bookings` is NOT NULL, so even if we skip the lookup, the insert would fail
3. There's also a bug on line 113: `booking_data: payload` references an undefined variable (should be `body`)

### Changes

**1. Database Migration**
Make `channex_bookings.property_id` nullable so test/unmapped bookings can be saved with `property_id = null`.

```sql
ALTER TABLE channex_bookings ALTER COLUMN property_id DROP NOT NULL;
```

**2. Edge Function: `supabase/functions/channex-booking-webhook/index.ts`**

Replace the hard-fail property lookup (lines 60-74) with graceful handling:

```text
// --- Resolve local property ID ---
const isTestProperty = !channexPropertyId || channexPropertyId.startsWith('test-') || channexPropertyId === 'test-property-id';
let localPropertyId: string | null = null;

if (!isTestProperty) {
  const { data: propMapping } = await supabase
    .from("channex_mappings")
    .select("local_id")
    .eq("channex_id", channexPropertyId)
    .eq("entity_type", "property")
    .maybeSingle();

  if (propMapping) {
    localPropertyId = propMapping.local_id;
  } else {
    console.warn(`[channex-booking-webhook] No local property for Channex ID ${channexPropertyId} - saving with null property_id`);
    await logSync("channex-booking-webhook", "webhook", body, null, null, true, `Warning: unknown property ${channexPropertyId}`, null);
  }
} else {
  console.log("[channex-booking-webhook] Test property detected, skipping property lookup");
}
```

Key behavior changes:
- Test property IDs (starting with "test-" or equal to "test-property-id") skip the lookup entirely
- Real property IDs that aren't found log a warning but **still save the booking** with `property_id = null`
- The booking is never discarded due to a missing mapping

Also fix the bug on line 113 where `booking_data: payload` should be `booking_data: body`.

Also skip the Channex ACK call for test bookings (revision IDs starting with "test-") since those would fail against the real Channex API.

### Summary of files changed
- **Database migration**: Make `channex_bookings.property_id` nullable
- **`supabase/functions/channex-booking-webhook/index.ts`**: Graceful property resolution, fix `payload` reference bug, skip ACK for test revisions
