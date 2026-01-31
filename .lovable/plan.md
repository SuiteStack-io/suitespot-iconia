

## Plan: Fix RLS Policy to Allow Front Desk Check-In/Check-Out

### Problem Identified

**Root Cause**: The RLS policy for updating reservations **does not include the `front_desk` role**.

The current policy is:
```sql
"Admins and managers can update reservations"
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
)
```

Dina Mamdouh has the `front_desk` role, so she cannot update the reservation status to `checked-out`.

**Historical Context**: A previous migration (`20251015112617`) replaced the original policy that included `front_desk` with one that only allows `admin` and `manager`. This was likely unintentional.

---

### Solution

Update the RLS policy to include `front_desk` role, restoring their ability to:
- Check in guests (update status to `checked-in`)
- Check out guests (update status to `checked-out`)
- Record access card counts

---

### Technical Changes

#### Database Migration

Create a new migration to update the reservations UPDATE policy:

```sql
-- Restore front desk ability to update reservations for check-in/check-out
DROP POLICY IF EXISTS "Admins and managers can update reservations" ON reservations;

CREATE POLICY "Admins, managers, and front desk can update reservations"
ON reservations FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'front_desk'::app_role)
);
```

---

### Verification

After the fix, the reservation for Room 505 (Ammar Alhindi) should be checkable out by Dina Mamdouh.

| Before | After |
|--------|-------|
| Only `admin` and `manager` can update | `admin`, `manager`, and `front_desk` can update |
| Dina's checkout attempt fails silently | Checkout works correctly |

---

### Files to Modify

| Change | Details |
|--------|---------|
| New database migration | Update reservations UPDATE policy to include `front_desk` role |

