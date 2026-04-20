

## Fix: Add 'manager' Role to 4 Notification Edge Functions

### Overview
Update 4 Edge Functions that currently exclude the 'manager' role from their recipient lists. This ensures managers with notification settings enabled receive check-in, check-out, KYC, shuffle, and conflict alert emails.

### Files to Modify

**1. `supabase/functions/send-kyc-completion-notification/index.ts` (line 40)**
```diff
- .in("role", ["admin", "front_desk"]);
+ .in("role", ["admin", "manager", "front_desk"]);
```

**2. `supabase/functions/auto-shuffle-rooms/index.ts` (line 432)**
```diff
- .in('role', ['admin', 'front_desk']);
+ .in('role', ['admin', 'manager', 'front_desk']);
```

**3. `supabase/functions/allocate-unit/index.ts` (line 223)**
```diff
- .in('role', ['admin', 'front_desk']);
+ .in('role', ['admin', 'manager', 'front_desk']);
```

**4. `supabase/functions/send-mid-stay-cleaning-notifications/index.ts` (line 175)**
```diff
- .filter((u: any) => u.email && (u.role === 'admin' || u.role === 'housekeeping'));
+ .filter((u: any) => u.email && (u.role === 'admin' || u.role === 'manager' || u.role === 'housekeeping'));
```

### What Does NOT Change
- No changes to email templates or content
- No changes to property access filtering logic
- No changes to notification preference reading
- No changes to other notification functions (already include manager)

### Verification
After deployment, managers like Emad Rezk with `check_in_notifications` and `check_out_notifications` enabled will be included in recipient lists for:
- KYC completion notifications
- Auto-shuffle room alerts
- Unit allocation conflict alerts
- Mid-stay cleaning notifications

