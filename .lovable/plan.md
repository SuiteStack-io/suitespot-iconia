

## Fix: Auto-Assign Room Type Lookup for Channex Bookings + Re-run for Andrew Tadros

### Root Cause (Confirmed)

Line 51 of `auto-assign-rooms/index.ts` selects reservation fields but **omits `channex_booking_id`**. Line 90 then tries to match `channex_bookings` using `res.booking_reference` (OTA code like `"6718675960"`), but `channex_bookings.channex_booking_id` stores the Channex UUID (`"3fc276f1-ee08-4c11-8238-43a41111cf8b"`). These never match → room type = null → "Unknown".

### Verified Data
- Andrew Tadros reservation: `bf0d9807-613c-471e-b62c-c5b07cfa532c`, Apr 8–12, confirmed, no unit assigned
- His `channex_booking_id`: `3fc276f1-ee08-4c11-8238-43a41111cf8b`
- That maps to `room_type_id`: `3ca13973-c38c-4084-9a7a-f390cf20ee55` → "Suite with Terrace"
- 3 units of that type: 501, 502, 505

### Fix — 1 File, Then Re-run

**File: `supabase/functions/auto-assign-rooms/index.ts`**

1. **Line 51**: Add `channex_booking_id` to the select:
   ```
   .select("id, check_in_date, check_out_date, guest_names, property_id, unit_id, booking_reference, channex_booking_id")
   ```

2. **Line 78 (interface)**: Add `channex_booking_id` field:
   ```typescript
   channex_booking_id: string | null;
   ```

3. **Line 90**: Use `channex_booking_id` first, fall back to `booking_reference`:
   ```typescript
   .eq("channex_booking_id", (res as any).channex_booking_id || res.booking_reference)
   ```

4. **After line 128**: Add diagnostic log:
   ```typescript
   console.log(`[auto-assign-rooms] Reservation ${res.id}: channex_booking_id=${(res as any).channex_booking_id}, booking_ref=${res.booking_reference}, resolved room_type=${roomTypeName}`);
   ```

**Post-deploy**: Invoke `auto-assign-rooms` with `reservation_ids: ["bf0d9807-613c-471e-b62c-c5b07cfa532c"]` to assign Andrew Tadros to a Suite with Terrace.

### Summary
- 1 edge function edited (4 small changes)
- 1 re-run via curl to resolve Andrew Tadros's booking
- No changes to webhook, manual flow, calendar, or shuffle algorithm

