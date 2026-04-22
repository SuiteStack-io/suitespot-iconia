

## Grant `super_admin` Equal Access Everywhere

Replace every hardcoded `userRole === 'admin'` / `userRole !== 'admin'` check with one that also accepts `super_admin`. `admin` behavior is preserved verbatim — `super_admin` is purely additive.

### 1. Frontend pages — gate / data fetch

Each file: change `userRole === 'admin'` → `(userRole === 'admin' || userRole === 'super_admin')` and `userRole !== 'admin'` → `(userRole !== 'admin' && userRole !== 'super_admin')`.

| File | Lines |
|------|-------|
| `src/pages/Users.tsx` | 48, 54, 189 |
| `src/pages/Analytics.tsx` | 149, 155 |
| `src/pages/Commissions.tsx` | 66, 73 |
| `src/pages/AlmazaBay.tsx` | 265, 1469 |
| `src/pages/Guests.tsx` | 67 |
| `src/pages/GuestForms.tsx` | 103 |
| `src/pages/GuestInbox.tsx` | 65 |
| `src/pages/front-desk/RoomRates.tsx` | 73 |
| `src/pages/Index.tsx` | 152 |

### 2. Frontend components

| File | Lines |
|------|-------|
| `src/components/SlideMenu.tsx` | 95, 202 |
| `src/components/inbox/ConversationPanel.tsx` | 79 |
| `src/components/settings/PropertyList.tsx` | 18, 19 |

### 3. AdminRoute — already covers super_admin
`src/components/AdminRoute.tsx` line 13 already allows both. No change.

### 4. Out of scope (intentionally unchanged)
- `src/components/EditPermissionsDialog.tsx` line 254 — `user?.role === 'admin'` refers to the **target user being edited** (a property `admin` whose permissions are auto-granted), not the current user. Unrelated to platform access.
- `src/lib/auth.tsx` `hasPermission` — already short-circuits on both roles.
- `src/lib/propertyContext.tsx` — already includes `super_admin` everywhere needed.

### 5. Edge Functions

The notification senders (`send-checkin-notification`, `send-checkout-notification`, `send-late-checkout-notification`, `send-room-change-notification`, `send-cancellation-notification`, `send-reservation-notification`, `send-modification-notification`, `send-extension-notification`, `send-mid-stay-cleaning-notifications`, `auto-shuffle-rooms`, `generate-daily-summary`) all contain:

```ts
if (userAccessEntries.length === 0 && user.role === 'admin') {
  // global access fallback
  return true;
}
```

Update each to:

```ts
if (userAccessEntries.length === 0 && (user.role === 'admin' || user.role === 'super_admin')) {
```

Plus `send-mid-stay-cleaning-notifications` line 176 role allowlist:
```ts
.filter((u: any) => u.email && (u.role === 'admin' || u.role === 'super_admin' || u.role === 'manager' || u.role === 'housekeeping'));
```

The two admin-gate edge functions (`channex-sync-property` line 64, `channex-reset-sync` line 47) currently query `.eq('role', 'admin')`. Change to:
```ts
.from('user_roles').select('role').eq('user_id', user.id).in('role', ['admin', 'super_admin']).maybeSingle();
```

### 6. Memory update
Append a Core rule to `mem://index.md`: "Hardcoded admin checks must always include `super_admin` (e.g. `userRole === 'admin' || userRole === 'super_admin'`)." This prevents regressions in future feature work.

### Verification
1. Youssef (`super_admin`) → SlideMenu shows Commissions, Cash Settlement, Analytics, Users, Rooms, Inbox; can open every admin-gated page without redirect.
2. Ahmed (`admin`) → identical behavior to before.
3. `manager` / `front_desk` / `housekeeping` users → unchanged.
4. Edge function admin-gate calls succeed for super_admin (e.g. `channex-sync-property`).
5. Notification recipient resolution includes super_admin users with no property access rows.

