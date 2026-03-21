

## Fix Dark Mode Email Visibility Across All Email Templates

### Problem
Dark-background headers (navy, red, amber, blue, purple, gold) become transparent or inverted in dark mode email clients, making white text invisible.

### Approach
For every email template with a colored header background:
1. Add `<meta name="color-scheme" content="light dark">` and `<meta name="supported-color-schemes" content="light dark">` to the `<head>` section
2. Add a `<style>` block with `@media (prefers-color-scheme: dark)` rules that force header backgrounds and text colors with `!important`
3. Add `text-shadow: 0 0 1px rgba(0,0,0,0.5)` on white header text as a fallback if backgrounds get stripped
4. For table header rows (`th` with dark backgrounds), add inline `!important` via `<style>` overrides
5. For templates that only use inline styles (no `<head>`), wrap content in a minimal `<!DOCTYPE html><html><head>...</head><body>...</body></html>` structure

### Files to Modify (13 files)

**Summary emails (navy gradient headers + dark table headers):**
1. `generate-daily-summary/index.ts` — Add `<!DOCTYPE html><html><head>` wrapper with meta tags, dark mode `<style>` block; add `text-shadow` + `!important` on header text; add dark mode protection for `th` backgrounds
2. `generate-weekly-summary/index.ts` — Same as daily
3. `generate-monthly-summary/index.ts` — Same as daily

**Notification emails with colored headers (table-based layout):**
4. `send-cancellation-notification/index.ts` — Add meta tags + dark mode `<style>` block for red `#dc2626` header
5. `send-modification-notification/index.ts` — Add meta tags + dark mode styles for amber gradient header
6. `send-room-change-notification/index.ts` — Same as modification
7. `auto-shuffle-rooms/index.ts` — Same as modification (amber header)

**Notification emails with colored headers (div-based layout):**
8. `send-extension-notification/index.ts` — Add wrapper with meta tags + dark mode styles for blue gradient header
9. `send-late-checkout-notification/index.ts` — Add wrapper + dark mode styles for amber gradient header
10. `send-ticket-notification/index.ts` — Add meta tags + dark mode styles for dynamic-color header

**Emails with `<style>` tags but no dark mode block:**
11. `send-guest-credentials/index.ts` — Add meta tags + dark mode `@media` block for purple gradient header
12. `send-kyc-reminder/index.ts` — Add meta tags + dark mode block for gold gradient header
13. `send-kyc-completion-notification/index.ts` — Add meta tags + dark mode block for gold gradient header

**Already fixed (no changes needed):**
- `send-reservation-notification/index.ts` — Already has dark mode CSS

**No colored headers (no changes needed):**
- `send-checkin-notification`, `send-checkout-notification`, `send-admin-notification`, `send-checkout-surveys`, `send-survey-notification` — These use simple colored text headings without dark background headers

### Dark Mode CSS Pattern (applied per template)
```html
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
  @media (prefers-color-scheme: dark) {
    .email-header { background: [original-color] !important; }
    .email-header h1, .email-header p, .email-header div { color: #ffffff !important; }
    .dark-th { background: #1e293b !important; color: #ffffff !important; }
  }
</style>
```

For inline-only templates (summaries), the header div gets `class="email-header"` added alongside existing inline styles, and `th` elements get `class="dark-th"`.

### No Changes To
- Email content, data, recipient logic, or notification settings
- Color values themselves (same navy/red/amber/blue/purple/gold)
- `send-reservation-notification` (already has dark mode support)

