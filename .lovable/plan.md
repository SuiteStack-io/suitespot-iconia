

## Fix: Manager Role Excluded from Check-In/Check-Out Notification Recipients

### Root Cause

Emad Rezk has role `manager` with property access to ICONIA Zamalek and notification settings defaulted to ON. He is correctly set up. However, **5 notification edge functions hardcode the recipient list to `['admin', 'front_desk']` only**, silently dropping managers before the preference and property-access filters run.

This is inconsistent with the project's own standard — `send-reservation-notification`, `send-cancellation-notification`, `send-modification-notification`, and `send-room-change-notification` already include `manager` in `["admin", "manager", "front_desk"]`.

### The Fix

Add `'manager'` to the role filter in these 5 files. No other logic changes needed — property access filtering (which already correctly handles managers via `user_property_access`) and notification-preference filtering (which respects `checkin_email` / `checkout_email` toggles, defaulting to `true` when no row exists) will then run for managers as expected.

#### Files

**1. `supabase/functions/send-checkin-notification/index.ts` (line 102)**
```diff
- .filter((u: any) => u.email && ['admin', 'front_desk'].includes(u.role));
+ .filter((u: any) => u.email && ['admin', 'manager', 'front_desk'].includes(u.role));
```

**2. `supabase/functions/send-checkout-notification/index.ts` (line 103)**
```diff
- const admins = userData.filter((user: any) => ['admin', 'front_desk'].includes(user.role));
+ const admins = userData.filter((user: any) => ['admin', 'manager', 'front_desk'].includes(user.role));
```

**3. `supabase/functions/send-extension-notification/index.ts` (line 83)** — same change

**4. `supabase/functions/send-late-checkout-notification/index.ts` (line 78)** — same change

**5. `supabase/functions/send-admin-notification/index.ts` (line 72)** — same change

### Property-Access Filter — One Detail to Confirm

The `filterByPropertyAccess` helper in `send-checkin-notification` (line 318) currently grants global access only to users where `role === 'admin'` AND no `user_property_access` rows exist. Managers must have at least one explicit `user_property_access` row to pass — Emad does, so he's fine. **No change needed here**, but it's worth being aware that a manager with no property-access rows would still be skipped (this is correct behavior: managers don't get global access).

### Verification After Deploy

1. Query confirms Emad will be included for ICONIA Zamalek check-ins:
   ```sql
   SELECT p.full_name, ur.role, upa.role AS property_role
   FROM profiles p
   JOIN user_roles ur ON ur.user_id = p.id
   LEFT JOIN user_property_access upa
     ON upa.user_id = p.id
     AND upa.property_id = 'c98a2256-1787-47a4-bf0f-61942b4e87d5'
   WHERE ur.role IN ('admin','manager','front_desk');
   ```
2. Trigger a test check-in on an ICONIA Zamalek reservation — Emad should receive the email.
3. Edge function logs will show `Found N admin users, N after prefs, N after property access` — Emad's email should appear in the per-recipient log lines.

### Out of Scope (unchanged)

- Email templates, sender address, rate-limiting delay
- Permission UI / `EditPermissionsDialog`
- Other notification types already including `manager`
- Database schema / RLS policies
- The `user_notification_settings` table (defaults already work correctly for users without a row)

