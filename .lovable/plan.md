

## Audit & Fix: Edge Function `verify_jwt` Settings in config.toml

### Current State
- **51 total edge functions** exist in the project
- **39 functions** are listed in config.toml (all with `verify_jwt = false`)
- **12 functions** are missing from config.toml entirely (defaulting to `verify_jwt = true`)

### Categorization of Missing Functions

**Called by BROWSER (need auth — should keep `verify_jwt = false` per Lovable Cloud default, but do in-code auth):**
- `create-admin-user` — browser via `supabase.functions.invoke`, does its own auth check
- `create-guest-account` — browser via `supabase.functions.invoke`, does its own auth check
- `generate-selection-credentials` — browser via `supabase.functions.invoke`
- `parse-reservation-screenshot` — browser via `supabase.functions.invoke`
- `update-user-email` — browser via `supabase.functions.invoke`
- `verify-selection-password` — browser via `supabase.functions.invoke` (public, no auth needed)

**Called by BROWSER but notification-style (should be `verify_jwt = false`):**
- `send-admin-notification` — browser via `supabase.functions.invoke`
- `send-checkout-surveys` — browser via `supabase.functions.invoke`
- `send-guest-credentials` — browser via `supabase.functions.invoke`
- `send-kyc-reminder` — browser via `supabase.functions.invoke`
- `send-survey-notification` — browser via `supabase.functions.invoke`

**Not referenced anywhere (orphan, but should still be configured):**
- `send-ticket-notification` — no callers found, but follows the notification pattern

### Decision
Per Lovable Cloud conventions, **all functions should have `verify_jwt = false`** since they either do in-code auth or are called internally. The 12 missing functions need entries added.

### Plan

#### File: `supabase/config.toml`
1. Add a comment block at the top (after `project_id`) explaining the rule
2. Add `verify_jwt = false` entries for all 12 missing functions:
   - `create-admin-user`
   - `create-guest-account`
   - `generate-selection-credentials`
   - `parse-reservation-screenshot`
   - `send-admin-notification`
   - `send-checkout-surveys`
   - `send-guest-credentials`
   - `send-kyc-reminder`
   - `send-survey-notification`
   - `send-ticket-notification`
   - `update-user-email`
   - `verify-selection-password`

### Files Changed
- 1 file edited (`supabase/config.toml`)
- No code changes needed — only config

