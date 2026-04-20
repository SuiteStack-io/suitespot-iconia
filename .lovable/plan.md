

## Fix Fallback Email Domain: hostbase.io → hostbase.ai

### Change

**File**: `supabase/functions/_shared/property-settings.ts` (line 36)

```diff
- const GENERIC_FROM_EMAIL = 'notifications@hostbase.io';
+ const GENERIC_FROM_EMAIL = 'notifications@hostbase.ai';
```

This constant is the single source for the generic fallback used by every Edge Function when a property has no custom `from_email_*` configured. Updating the constant fixes all 5 fallback fields (`from_email_reservations`, `from_email_frontdesk`, `from_email_notifications`, `from_email_housekeeping`, `from_email_ai`) at once.

### Audit Result

A full codebase search for `hostbase.io` returned **5 matches in 1 file** — all 5 are usages of the single `GENERIC_FROM_EMAIL` constant within `property-settings.ts`. No other files (frontend, migrations, other edge functions, configs) reference `hostbase.io`. Changing the constant resolves every occurrence.

### Out of Scope
- No other files touched
- No template, recipient, or schema changes

