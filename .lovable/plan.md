

## Fix "Unknown" Users in Manage Users Dialog

### Root cause
Both the `profiles` SELECT RLS policy and the `get_all_users_with_emails()` RPC gate access on `has_role(auth.uid(), 'admin'::app_role)` only. Super admins (Youssef) hold `'super_admin'` in `user_roles`, not `'admin'`, so:
- They cannot read other users' rows from `profiles` → `full_name` is `null` → renders as "Unknown".
- The RPC raises `Only admins can access user information` → emails are `null` and the "Add User" dropdown is empty.

### Changes — DB migration only

1. **Update profiles RLS policy** to also allow super admins:
   ```sql
   DROP POLICY "Admins can view all profiles" ON public.profiles;
   CREATE POLICY "Admins and super admins can view all profiles"
     ON public.profiles FOR SELECT
     USING (
       has_role(auth.uid(), 'admin'::app_role)
       OR has_role(auth.uid(), 'super_admin'::app_role)
     );
   ```

2. **Update `get_all_users_with_emails()`** guard to accept both roles:
   ```sql
   IF NOT (has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)) THEN
     RAISE EXCEPTION 'Only admins can access user information';
   END IF;
   ```
   (Body unchanged otherwise.)

### No frontend changes needed
`ManagePropertyUsersDialog.tsx` already merges `profiles.full_name` and the RPC's `email` correctly — once the database stops returning empty for super admins, names and emails populate automatically.

### Out of scope
- No changes to `user_property_access`, role assignment, or any other component/page.
- No changes to the `app_role` enum or to existing `user_roles` rows.
- Other admin-gated RPCs and policies are not touched in this prompt (they continue to work for the regular `admin` role; can be normalized in a follow-up if needed).

### Verification
1. Logged in as Youssef (`super_admin`) → open Manage Users on ICONIA Zamalek → list shows: Ahmed Magdy, Nikola Bagaric, Emad Rezk, Dina Mamdouh — each with their email and role badge.
2. "Add User" dropdown is populated with remaining users (e.g. Youssef himself).
3. Logged in as Ahmed (`admin`) → behavior unchanged; same list still visible.
4. Logged in as a manager → still cannot view other profiles (policy unchanged for non-admins).

