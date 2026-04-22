

## Create Hostbase Super Admin & Demote Personal Account

Password received. Executing the atomic migration via a one-shot edge function.

### Steps (single edge function `create-super-admin-account`, deleted after success)

1. **Create auth user** — `supabase.auth.admin.createUser({ email: 'founders@hostbase.ai', password: 'a4GfRHzSk4LRALcM', email_confirm: true, user_metadata: { full_name: 'Youssef Noureldin' } })`. Capture `NEW_SUPER_ADMIN_ID`.
2. **Upsert profile** — `INSERT INTO profiles (id, full_name) VALUES (NEW_SUPER_ADMIN_ID, 'Youssef Noureldin') ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name` (covers both fresh insert and the `handle_new_user` trigger case).
3. **Assign super_admin role** — `INSERT INTO user_roles (user_id, role) VALUES (NEW_SUPER_ADMIN_ID, 'super_admin')`.
4. **Demote personal account** — `UPDATE user_roles SET role = 'admin' WHERE user_id = 'd540b87e-f856-4ef1-9193-2fb077366ef9'`.
5. **Grant ICONIA admin access to personal account** — `INSERT INTO user_property_access (user_id, property_id, role, granted_by) VALUES ('d540b87e-f856-4ef1-9193-2fb077366ef9', 'c98a2256-1787-47a4-bf0f-61942b4e87d5', 'admin', NEW_SUPER_ADMIN_ID) ON CONFLICT (user_id, property_id) DO UPDATE SET role = 'admin'`.

### Atomic rollback on failure

Wrapped in try/catch. On any error after auth user is created:
- `DELETE` the new auth user via `supabase.auth.admin.deleteUser(NEW_SUPER_ADMIN_ID)`
- `UPDATE user_roles SET role = 'super_admin' WHERE user_id = 'd540b87e-f856-4ef1-9193-2fb077366ef9'` (only if step 4 succeeded)
- `DELETE FROM user_property_access WHERE user_id = 'd540b87e-f856-4ef1-9193-2fb077366ef9' AND property_id = 'c98a2256-1787-47a4-bf0f-61942b4e87d5'` (only if step 5 succeeded)
- Return error details

### Cleanup

After success: delete the `create-super-admin-account` edge function so the password and one-shot logic don't linger.

### Verification queries (run after function returns success)

```sql
-- Expect: founders@hostbase.ai → super_admin, your account → admin
SELECT au.email, ur.role
FROM user_roles ur JOIN auth.users au ON au.id = ur.user_id
WHERE au.email IN ('founders@hostbase.ai','youssef@suitespotegypt.com');

-- Expect: 1 row for your account on ICONIA, 0 for the new super_admin
SELECT user_id, property_id, role FROM user_property_access
WHERE user_id IN (
  'd540b87e-f856-4ef1-9193-2fb077366ef9',
  (SELECT id FROM auth.users WHERE email='founders@hostbase.ai')
);
```

### Manual checklist (you, after migration)

1. Log out → log in as `founders@hostbase.ai` with the password you sent → property switcher shows all properties; admin pages load; Manage Users shows real names.
2. Log out → log in as `youssef@suitespotegypt.com` → switcher shows ICONIA only; all ICONIA admin actions still work; no "No properties assigned" banner.
3. Ahmed's session unchanged.

### Untouched

`app_role` enum, `has_permission`, `auto_assign_property_admin`, all 56 RLS policies, every other user, all frontend code.

