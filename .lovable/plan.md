

## Fix property deletion with cascading dependency cleanup

### What's happening now
The delete fails with `violates foreign key constraint "rate_plans_property_id_fkey"` because `rate_plans`, `units`, `reservations`, `message_threads`, and `summary_report_log` all have foreign keys to `properties(id)` without ON DELETE CASCADE. The current UI tries to delete the property row directly, which the database blocks.

### Solution

#### 1. Database migration — create `delete_property_with_dependencies` RPC function

A `SECURITY DEFINER` function that:
- Blocks deletion of the default property
- Blocks deletion if active reservations exist (status `confirmed` or `checked-in`)
- Deletes dependent rows in correct FK order:
  1. `message_threads` (where property_id = target)
  2. `room_shuffle_log` (where property_id = target)
  3. `whatsapp_message_log` (where property_id = target)
  4. `summary_report_log` (where property_id = target)
  5. `channel_markup_settings` (where property_id = target)
  6. `derived_rate_plan_mappings` (where property_id = target)
  7. `channex_sync_logs` (where property_id = target)
  8. `reservations` (where property_id = target) — child tables like `housekeeping_logs`, `stay_surveys` cascade automatically
  9. `rate_plans` (where property_id = target) — child tables like `rate_plan_prices`, `rate_plan_restrictions`, `rate_plan_value_adds` cascade automatically
  10. `units` (where property_id = target) — child tables like `blocked_dates`, `kyc_links`, `media_library` cascade automatically
  11. `user_property_access` (already has ON DELETE CASCADE, but explicit for clarity)
  12. `properties` row itself
- Returns void; raises exceptions with clear messages on failure

#### 2. Frontend — update `DeletePropertyDialog.tsx`

- Replace the two manual delete calls with a single `supabase.rpc('delete_property_with_dependencies', { p_property_id: property.id })`
- Map known error messages to user-friendly toasts:
  - "active bookings" → "Cannot delete — active bookings exist. Cancel or complete them first."
  - "default property" → "Cannot delete the default property. Set another as default first."
  - Fallback → "Failed to delete property"
- Update the warning text to say it removes all related data (rooms, rate plans, booking history, logs), not just user assignments

#### 3. Frontend — remove client-side reservation check from `PropertyList.tsx`

The reservation count logic and `handleDeleteAttempt` guard become redundant since the backend function handles this. Simplify to just open the dialog directly. Remove the `reservationCounts` state and query.

### What stays the same
- Typed-name confirmation dialog
- Default property has no trash icon
- `canEdit` gate on the trash button

