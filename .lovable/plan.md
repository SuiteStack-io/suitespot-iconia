

## Restructure Account Setup: Split Personal Admin from Hostbase Super Admin

### Pre-flight findings (verified just now)

| Check | Result |
|---|---|
| Your actual user_id | `d540b87e-f856-4ef1-9193-2fb077366ef9` (the ID in your prompt, `...b284-b0ba8a813a58`, is the **Lovable project ID** — typo) |
| Your current role | `super_admin` (sole holder) |
| Your current `user_property_access` rows | None (super_admin has global access) |
| `founders@hostbase.ai` already exists? | No |
| ICONIA Zamalek property_id | `c98a2256-1787-47a4-bf0f-61942b4e87d5` |
| RLS policies referencing `super_admin` | 56 (audit migration is in place) |

### ⚠️ Confirm before I proceed

The user_id in your prompt (`d540b87e-f21f-48c2-b284-b0ba8a813a58`) does **not** exist. Your real account is `d540b87e-f856-4ef1-9193-2fb077366ef9` (Youssef Noureldin / youssef@suitespotegypt.com). I'll proceed with that one — please confirm or correct.

### STOP — I need the password

Per your instructions, I will not hardcode a placeholder. **Please reply in chat with the password for `founders@hostbase.ai`** (min 6 chars, ideally strong). I will use it once and discard it.

### What I'll do once you reply with the password

A single edge function (`create-super-admin-account`, one-shot, deleted after success) executes everything atomically with the service role key:

1. **Create new auth user** via `supabase.auth.admin.createUser({ email: 'founders@hostbase.ai', password: <yours>, email_confirm: true, user_metadata: { full_name: 'Youssef Noureldin' } })`. Capture `NEW_SUPER_ADMIN_ID`.
2. **Insert profile** (or rely on `handle_new_user` trigger; will upsert `full_name` to be safe).
3. **Insert `user_roles`** row → `(NEW_SUPER_ADMIN_ID, 'super_admin')`.
4. **Demote your account** → `UPDATE user_roles SET role = 'admin' WHERE user_id = 'd540b87e-f856-4ef1-9193-2fb077366ef9'`.
5. **Grant your account explicit ICONIA admin access** → `INSERT INTO user_property_access (user_id, property_id, role, granted_by) VALUES ('d540b87e-f856-4ef1-9193-2fb077366ef9', 'c98a2256-1787-47a4-bf0f-61942b4e87d5', 'admin', NEW_SUPER_ADMIN_ID) ON CONFLICT (user_id, property_id) DO UPDATE SET role = 'admin'`.
6. **Skip** any insert into `user_property_access` for the new super_admin (auto_assign trigger already skips super_admins).

If any step throws, the function rolls back: deletes the new auth user (if created) and restores `user_roles` back to `super_admin` for your account. No partial state.

### What stays untouched

- `app_role` enum, `has_permission`, `auto_assign_property_admin`, all 56 RLS policies, `auth.tsx`, `propertyContext.tsx`, `AdminRoute.tsx`, every other user.

### Verification I'll run after the migration

```sql
-- Should show: founders@hostbase.ai → super_admin, your account → admin
SELECT au.email, ur.role FROM user_roles ur JOIN auth.users au ON au.id = ur.user_id;

-- Should show: 1 row for your account on ICONIA, 0 for the new super_admin
SELECT user_id, property_id, role FROM user_property_access
WHERE user_id IN ('d540b87e-f856-4ef1-9193-2fb077366ef9',
                  (SELECT id FROM auth.users WHERE email='founders@hostbase.ai'));
```

Then your manual checklist:
1. Log out, log in as `founders@hostbase.ai` → sees all properties, all admin pages, Manage Users shows real names.
2. Log out, log in as your original account → sees only ICONIA in property switcher, all ICONIA admin actions still work.
3. Ahmed's session → unchanged.
4. No "No properties assigned" banner anywhere.

### Fallback

Built into the edge function — on any thrown error, auth user is deleted and your role is restored to `super_admin`. I'll then report the failure and we'll debug before retrying.

### Awaiting your reply

1. **Password for `founders@hostbase.ai`** (required to proceed)
2. **Confirm** the corrected user_id `d540b87e-f856-4ef1-9193-2fb077366ef9` is your account (it is — youssef@suitespotegypt.com / Youssef Noureldin)

