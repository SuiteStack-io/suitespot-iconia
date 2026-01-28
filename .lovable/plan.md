

## Plan: Fix Guest Form Status Update Not Working

### Problem Identified
The guest check-in form saves successfully, but the reservation status is NOT being updated from `confirmed` to `checked-in`. This is confirmed by database data:

| Guest | Form Signed At | Reservation Status | checked_in_at |
|-------|---------------|-------------------|---------------|
| Ammar Alhindi | Jan 28, 1:52 PM | confirmed | null |
| Abraham Waxler | Jan 26, 11:52 AM | confirmed | null |
| H RRR | Jan 24, 1:32 PM | confirmed | null |

### Root Cause
The guest form is accessed by **unauthenticated users** (public URL). While the `check_in_agreements` table allows public inserts, the `reservations` table UPDATE is blocked by Row Level Security (RLS) policies that require authentication.

The code in `GuestCheckIn.tsx` lines 297-309 attempts to update the reservation:
```typescript
const { error: statusError } = await supabase
  .from('reservations')
  .update({ status: 'checked-in', checked_in_at: new Date().toISOString() })
  .eq('id', reservationId);
```

This update returns no error but affects 0 rows because RLS blocks unauthenticated updates.

---

### Solution: Create a Database Function with SECURITY DEFINER

Create a secure database function that bypasses RLS to update the reservation status. This function will:
1. Verify the check-in agreement exists for the reservation
2. Update the status only if the reservation is currently "confirmed"
3. Return success/failure for proper error handling

---

### Technical Changes

#### 1. Create Database Migration

Add a new PostgreSQL function `update_reservation_status_on_checkin`:

```sql
CREATE OR REPLACE FUNCTION public.update_reservation_status_on_checkin(
  p_reservation_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agreement_exists BOOLEAN;
  v_current_status TEXT;
BEGIN
  -- Check if a check-in agreement exists for this reservation
  SELECT EXISTS(
    SELECT 1 FROM check_in_agreements WHERE reservation_id = p_reservation_id
  ) INTO v_agreement_exists;
  
  IF NOT v_agreement_exists THEN
    RETURN FALSE;
  END IF;
  
  -- Get current reservation status
  SELECT status INTO v_current_status
  FROM reservations
  WHERE id = p_reservation_id;
  
  -- Only update if currently confirmed (prevent duplicate check-ins)
  IF v_current_status = 'confirmed' THEN
    UPDATE reservations
    SET status = 'checked-in',
        checked_in_at = NOW()
    WHERE id = p_reservation_id;
    
    RETURN TRUE;
  END IF;
  
  -- Already checked in or other status
  RETURN TRUE;
END;
$$;
```

#### 2. Update GuestCheckIn.tsx

Replace the direct update with an RPC call:

**Current code (lines 297-309):**
```typescript
const { error: statusError } = await supabase
  .from('reservations')
  .update({ 
    status: 'checked-in',
    checked_in_at: new Date().toISOString()
  })
  .eq('id', reservationId);

if (statusError) {
  console.error('Error updating reservation status:', statusError);
  toast.error('Check-in saved but status update failed');
}
```

**New code:**
```typescript
// Update reservation status using RPC (bypasses RLS for anonymous users)
const { data: statusUpdated, error: statusError } = await supabase
  .rpc('update_reservation_status_on_checkin', {
    p_reservation_id: reservationId
  });

if (statusError) {
  console.error('Error updating reservation status:', statusError);
  toast.error('Check-in saved but status update failed');
} else if (!statusUpdated) {
  console.error('Status update returned false - agreement may not exist');
  toast.error('Check-in saved but status update failed');
}
```

#### 3. Fix Existing Data

Run a one-time SQL to fix reservations that already have forms but were never marked as checked-in:

```sql
UPDATE reservations r
SET status = 'checked-in',
    checked_in_at = c.signed_at
FROM check_in_agreements c
WHERE r.id = c.reservation_id
  AND r.status = 'confirmed'
  AND r.check_out_date >= CURRENT_DATE;
```

---

### Files to Modify

| File | Changes |
|------|---------|
| Database | Create `update_reservation_status_on_checkin` function |
| `src/pages/GuestCheckIn.tsx` | Replace direct update with RPC call |
| Database | One-time fix for existing stuck reservations |

---

### Expected Result

1. When a guest completes the check-in form, the function will update the reservation status
2. The "Check-In Status" column will correctly show "Checked In" for guests who completed the form
3. Existing stuck reservations will be fixed by the data repair query
4. The function is secure - it only updates status if a valid check-in agreement exists

