

## Gmail-Safe Dark Mode Fix: Table-Based Email Templates

### Problem
Gmail strips `<style>` tags and `!important` from inline styles, making all CSS-based dark mode fixes ineffective. Headers with dark backgrounds become transparent, making white text invisible.

### Approach
Convert all email headers from div/CSS-class-based to table-based with `bgcolor` attributes. Remove all `<style>` blocks and CSS classes. Use `color-scheme: light` only to prevent dark mode inversion. Replace all `rgba()` with solid hex.

### Files to Modify (13 files)

**Pattern for every header:**
- Replace `<div class="email-header" style="background:...">` with `<table><tr><td bgcolor="#HEXCOLOR" style="background-color:#HEXCOLOR;">`
- Remove ALL `<style>` blocks from `<head>`
- Remove ALL `class="..."` attributes
- Change meta tag to `content="light"` only
- Replace `rgba(255,255,255,0.9)` → `#ffffff`
- Remove `!important` everywhere (useless in Gmail, clutters code)
- Add `bgcolor` on every `<th>`/`<td>` that has a dark background

**Summary emails (div-based headers + `class="dark-th"` table headers):**
1. `generate-daily-summary/index.ts` — Convert header div to table with `bgcolor="#0f172a"`. Convert all `thStyle` to use `bgcolor="#1e293b"` instead of class. Remove `<style>` block from `dmHead`. Update meta tags.
2. `generate-weekly-summary/index.ts` — Same pattern as daily.
3. `generate-monthly-summary/index.ts` — Same pattern as daily.

**Table-based emails with `<style>` blocks (already use `<td>` for header but rely on class + `!important`):**
4. `send-cancellation-notification/index.ts` — Remove `<style>` block, remove `class="email-header"`, add `bgcolor="#dc2626"` on header `<div>`→convert to `<td>`, remove `!important`.
5. `send-modification-notification/index.ts` — Remove `<style>` block, add `bgcolor="#d97706"` on header `<td>`, remove class, remove `!important`, replace rgba.
6. `send-room-change-notification/index.ts` — Same as modification.
7. `auto-shuffle-rooms/index.ts` — Same as modification.

**Div-based emails with `<style>` blocks:**
8. `send-extension-notification/index.ts` — Convert header div to table td with `bgcolor="#1d4ed8"`, remove `<style>`, remove class, remove `!important`.
9. `send-late-checkout-notification/index.ts` — Convert header div to table td with `bgcolor="#d97706"`, same cleanup.
10. `send-ticket-notification/index.ts` — Convert `.header` div to table td with `bgcolor` (dynamic color), remove entire `<style>` block, inline all styles, remove classes.

**Emails with full `<style>` blocks (CSS class-only styling):**
11. `send-guest-credentials/index.ts` — Convert `.header` div to table td with `bgcolor="#764ba2"`, inline all styles from `<style>` block onto elements, remove `<style>` block and all classes.
12. `send-kyc-reminder/index.ts` — Convert `.header` div to table td with `bgcolor="#d4af37"`, inline all styles, remove `<style>` block.
13. `send-kyc-completion-notification/index.ts` — Same as KYC reminder.

**Reservation notification (2 email templates in one file):**
14. `send-reservation-notification/index.ts` — Both customer confirmation and internal notification emails: convert `.header` div to table td with `bgcolor="#0f172a"`, remove `<style>` block, inline all styles, remove classes.

### What Does NOT Change
- Email content, data, queries, recipient logic
- Color values (same navy/red/amber/blue/purple/gold)
- The emails look identical in light mode

