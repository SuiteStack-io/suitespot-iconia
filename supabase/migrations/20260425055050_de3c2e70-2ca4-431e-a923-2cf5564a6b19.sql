-- Drop per-row trigger that fans out duplicate Channex calls when blocked_dates rows are inserted/deleted.
-- Manual blocked_date writes (BlockedDatesManager + useLateCheckout) now push to Channex directly
-- via channex-push-availability with batched, range-collapsed updates.
-- The function notify_channex_blocked_dates_change() is intentionally KEPT so the trigger can be
-- recreated later if needed for any non-UI write paths.
DROP TRIGGER IF EXISTS on_blocked_dates_change_channex ON public.blocked_dates;