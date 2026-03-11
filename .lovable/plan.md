

## Fix: Use `booking_revisions` endpoint instead of `bookings` endpoint

### Change

**File:** `supabase/functions/channex-booking-webhook/index.ts` (lines 93-105)

Replace the enrichment block to use the revision endpoint with `revisionId` instead of the bookings endpoint with `booking_id`:

```typescript
// --- Enrich thin payloads by fetching revision from Channex API ---
let enrichedData = bookingData;
const isTestRevision = !revisionId || String(revisionId).startsWith('test-');
if (!bookingData.arrival_date && !bookingData.check_in && revisionId && !isTestRevision) {
  console.log("[channex-booking-webhook] Thin payload detected, fetching revision from API...");
  try {
    const revisionResponse: any = await channexRequest("GET", `/api/v1/booking_revisions/${revisionId}`);
    const revisionData = revisionResponse?.data?.attributes || revisionResponse?.data || revisionResponse;
    const bookingFromRevision = revisionData?.booking || revisionData;
    enrichedData = { ...bookingData, ...bookingFromRevision };
    console.log("[channex-booking-webhook] Enriched from revision API, keys:", Object.keys(enrichedData));
  } catch (fetchErr: any) {
    console.warn("[channex-booking-webhook] Could not fetch booking revision:", fetchErr.message);
  }
}
```

This switches from the mutable `/api/v1/bookings/:id` to the immutable `/api/v1/booking_revisions/:revision_id`, ensuring each revision is processed exactly as it was at that point in time. The `revisionId` variable is already extracted earlier in the function (line 63). One block changed, one file.

