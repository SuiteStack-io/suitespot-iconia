
## Remove Gmail Sync Integration

### Overview
Delete the broken Gmail/Booking.com email sync integration entirely -- all edge functions, UI components, and related references.

### What Gets Removed

**1. Edge Functions (4 functions)**
- `supabase/functions/gmail-auth-start/index.ts` -- OAuth flow start
- `supabase/functions/gmail-auth-callback/index.ts` -- OAuth callback
- `supabase/functions/sync-booking-gmail/index.ts` -- The main sync logic
- `supabase/functions/test-gmail-connection/index.ts` -- Connection test

**2. Frontend Components (2 files)**
- `src/components/SyncButton.tsx` -- Standalone sync button component
- `src/components/GmailSyncStatus.tsx` -- Gmail connection status card

**3. UI References**
- `src/pages/Settings.tsx` -- Remove the `<GmailSyncStatus />` card and its import
- `src/pages/Index.tsx` -- Remove the inline "Sync" button in the admin header bar, the `handleSync` function, and the `syncing` state

**4. Config Cleanup**
- `supabase/config.toml` -- Remove the `[functions.gmail-auth-start]`, `[functions.gmail-auth-callback]`, and `[functions.sync-booking-gmail]` entries

### What Gets Kept
- The `sync_status`, `sync_logs` tables and existing data stay untouched (no data deletion)
- The Sync History card on Settings page stays (it shows general sync activity)
- Secrets (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`) remain in Lovable Cloud but will simply be unused
