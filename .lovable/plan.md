

## Fix: Duplicate Notifications Showing in Bell Icon

### Root Cause
The notifications are **not actually duplicated** — the `notify_new_reservation` database trigger correctly creates one notification per user (5 users with admin/manager/front_desk roles = 5 notifications). The bug is in the **query**: neither `NotificationCenter.tsx` nor `useNotifications.tsx` filters by `user_id`, and the RLS policy for admins/front_desk allows viewing ALL users' notifications. So the logged-in admin sees all 5 notifications instead of just their own.

### Fix (2 files)

#### 1. `src/hooks/useNotifications.tsx` — Add user_id filter
In `fetchNotifications()`, get the current user's ID and filter:
```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) return;

const { data, error } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', user.id)    // ← ADD THIS
  .order('created_at', { ascending: false })
  .limit(20);
```

#### 2. `src/components/NotificationCenter.tsx` — Add user_id filter
Same fix in its `fetchNotifications()`:
```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) return;

const { data, error } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', user.id)    // ← ADD THIS
  .order('created_at', { ascending: false })
  .limit(20);
```

Also filter the realtime subscription to only show notifications for the current user (add a client-side check in the `postgres_changes` callback).

### Result
Each user sees exactly 1 "New Reservation" notification per booking — their own.

### Summary
- 2 files edited (add `.eq('user_id', user.id)` to queries)
- No migration needed
- No trigger changes needed

