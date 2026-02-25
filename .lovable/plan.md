
## Objective
Fix the redirect bug that still prevents Dina (front_desk + `can_access_front_desk`) from accessing the **Guests** page.

## What I found
I reviewed the current `Guests` page guards and found **two competing redirects**:

1. Correct front-desk permission guard:
- Allows admins, and allows non-admin users only when `hasPermission('can_access_front_desk')` is true.
- Redirects unauthorized users to `/admin`.

2. Legacy admin-only guard (still present):
- If user is not admin, it unconditionally redirects to `/`.
- This overrides Dina’s valid front-desk permission and causes the exact behavior reported: she lands on homepage.

So the root cause is **not** the recent auth loading fix; it is an old leftover guard in `src/pages/Guests.tsx`.

## Implementation plan
1. **Remove the legacy admin-only redirect effect** from `src/pages/Guests.tsx`:
   - Delete:
   ```ts
   useEffect(() => {
     if (!authLoading && userRole !== "admin") {
       navigate("/");
     }
   }, [userRole, authLoading, navigate]);
   ```

2. **Keep the granular front-desk guard only**:
   - This is the correct access model already aligned with your permission system:
   ```ts
   if (!authLoading && userRole && userRole !== 'admin' && !hasPermission('can_access_front_desk')) {
     navigate('/admin');
   }
   ```

3. **No backend/database changes**:
   - Roles remain in `user_roles`.
   - Permission remains in `user_permissions`.
   - No RLS/policy migration required for this specific bug.

## Validation plan (end-to-end)
I will verify with the following checks:
1. Log in as Dina.
2. Open `/guests` from the sidebar and direct URL.
3. Confirm page loads (no redirect to `/`).
4. Confirm unauthorized role without `can_access_front_desk` is redirected to `/admin`.
5. Confirm admin still accesses `/guests` normally.

## Technical details (for developers)
- **File to edit:** `src/pages/Guests.tsx`
- **Change type:** client-side route guard cleanup
- **Risk level:** low (single redundant effect removal)
- **Why this is safe:** existing permission-based guard already enforces intended access; removing duplicate contradictory logic restores expected behavior.

## Expected outcome
Dina will be able to open the **Guests** page successfully, while access control remains enforced for users without front desk permission.
