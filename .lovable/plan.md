

## Fix: Duplicate `isTestRevision` Declaration Crashing Webhook

### Root Cause
The `channex-booking-webhook` edge function has `const isTestRevision` declared **twice** in the same scope:
- **Line 95**: Used for the enrichment block
- **Line 413**: Used for the ACK block

This causes a `SyntaxError: Identifier 'isTestRevision' has already been declared` at boot time, meaning the function **never starts** — no logs, no processing, instant 500 to Channex.

The edge function logs confirm this:
```
worker boot error: Uncaught SyntaxError: Identifier 'isTestRevision' has already been declared
```

### Fix

**File:** `supabase/functions/channex-booking-webhook/index.ts`

**Line 413** — Remove the duplicate declaration. The `isTestRevision` variable from line 95 is already in scope and has the same value. Simply delete line 413 and use the existing variable.

Change:
```typescript
const isTestRevision = !revisionId || String(revisionId).startsWith('test-');
if (isTestRevision) {
```

To:
```typescript
if (isTestRevision) {
```

One line removed, one file. The function will boot again and process webhooks normally.

