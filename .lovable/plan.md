

## Diagnosis: Check-in/Check-out Emails Broken

### Root Cause
The edge function logs show a **PGRST201 error** — PostgREST cannot disambiguate the `units` relationship because the `reservations` table now has **two foreign keys** to `units`:
- `unit_id` (the actual room)
- `shuffled_from_unit_id` (added for room shuffle tracking)

Both `send-checkin-notification` and `send-checkout-notification` use:
```typescript
.select('*, units(name, booking_com_name, unit_number)')
```
This is ambiguous and fails with: *"Could not embed because more than one relationship was found for 'reservations' and 'units'"*

### Fix
Disambiguate the join by specifying the foreign key:

**File 1:** `supabase/functions/send-checkin-notification/index.ts` (line 33)
```typescript
// Before:
.select('*, units(name, booking_com_name, unit_number)')
// After:
.select('*, units!reservations_unit_id_fkey(name, booking_com_name, unit_number)')
```

**File 2:** `supabase/functions/send-checkout-notification/index.ts` (line 49)
```typescript
// Before:
.select('*, units(name, booking_com_name, unit_number, estimated_cleaning_minutes)')
// After:
.select('*, units!reservations_unit_id_fkey(name, booking_com_name, unit_number, estimated_cleaning_minutes)')
```

### Other findings
- Edge functions are deployed and active (logs show boot events)
- RESEND_API_KEY secret is configured
- Email templates and logic are intact
- The functions are called from client code (not database triggers), so no trigger issue
- No other changes needed — just the two `.select()` lines

Two line changes, two files.

