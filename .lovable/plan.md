

## Audit: Admin RLS Policies & RPCs Missing `super_admin`

### What I found

**46 RLS policies** across 33 tables guard access with `has_role(auth.uid(), 'admin'::app_role)` but never check `'super_admin'`. **7 functions** do the same. Super admins currently fail every one of these checks at the DB layer.

#### Functions to update
| Function | Treatment |
|---|---|
| `has_permission(_user_id, _permission)` | Add `super_admin` short-circuit (mirrors `admin`). Fixes every permission gate app-wide in one shot. |
| `reset_guest_password` | Add `super_admin` to guard. |
| `notify_new_reservation` | Add `super_admin` to recipient role list so super admins receive in-app notifications. |
| `notify_new_ticket` | Same. |
| `notify_room_reassignment` | Same. |
| `notify_admins_on_sync_error` | Same. |
| `auto_grant_admin_property_access` | Skip super admins (they don't need rows in `user_property_access`); only grant to `admin` role. |

#### RLS policies to update (add `OR has_role(auth.uid(), 'super_admin'::app_role)`)

Tables (full list, all currently admin-gated only):
`audit_logs`, `blocked_dates` (3), `blog_posts`, `booking_com_sync_log`, `channel_markup_settings`, `channex_alerts`, `channex_bookings`, `channex_mappings`, `channex_property_config`, `check_in_agreements`, `companies`, `derived_rate_plan_mappings`, `faq_items`, `guest_accounts`, `guest_inventory_access`, `guest_tickets`, `housekeeping_logs`, `kyc_links`, `media_library`, `nearby_amenities`, `notifications`, `properties` (2 INSERT policies), `property_amenities`, `rate_plan_prices`, `rate_plan_value_adds` (3), `room_shuffle_log`, `selection_accounts`, `slideshow_images` (3), `stay_surveys`, `summary_report_log`, `sync_logs`, `sync_status`, `ticket_surveys`, `user_notification_settings`, `user_permissions`, `user_roles` (4), `whatsapp_message_log`, `whatsapp_message_templates`.

### Strategy

Single migration that:

1. **Patches `has_permission`** to short-circuit on `super_admin` as well as `admin`. This alone covers any policy or RPC that calls `has_permission()` — no further work needed for those.
2. **Patches the 6 other admin-gated functions** to include `super_admin` in their role guards / recipient queries.
3. **DROP + CREATE each of the 46 policies** with the new check `has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)`. Existing extra clauses (e.g. `OR has_permission(...)`, `OR is_system_admin(...)`, `EXISTS (... role IN ('admin','manager') ...)`) are preserved verbatim — only the admin check is widened. For policies with array role lists (`rate_plan_prices`), `'super_admin'::app_role` is added to the array.

### Out of scope (intentionally untouched)

- `is_system_admin`, `has_role`, `has_property_access`, `has_property_role`, `user_has_property_access`, `auto_assign_property_admin` — already handle super_admin correctly or are role-agnostic.
- `app_role` enum, `user_roles` data, Edge Functions (already updated separately, read raw DB role).
- Frontend code (already normalized via `userRole='admin'` shim in `auth.tsx`).

### Verification

1. Logged in as Youssef (`super_admin`), open any of: KYC management, slideshow editor, blog editor, FAQ manager, channel markup, derived rate plans, audit logs, sync logs → all load and allow CRUD.
2. New reservation / ticket / room reassignment / sync error → Youssef receives in-app notification.
3. `auto_grant_admin_property_access` no longer creates redundant rows for super admins on new property creation.
4. Logged in as Ahmed (`admin`) → behavior unchanged across the board.
5. Manager / front_desk / housekeeping → unchanged (no policies were widened beyond admin/super_admin).

