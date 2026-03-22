

## Fix send-reservation-notification: Gmail-Safe Dark Mode

### Problem
The internal notification email (lines 539-767) still uses a full `<style>` block with CSS classes (`.header`, `.content`, `.detail-row`, etc.) and `@media (prefers-color-scheme: dark)` — all stripped by Gmail. The customer confirmation email (lines 167-292) uses CSS classes (`class="detail-row"`, `class="highlight"`, `class="info-box"`, `class="footer"`) that have no backing `<style>` block, so they render unstyled.

### Changes — `supabase/functions/send-reservation-notification/index.ts`

**Internal notification email (lines 539-767):**
1. Remove entire `<style>` block (lines 544-617)
2. Replace `<div class="header">` with `<table><tr><td bgcolor="#0f172a">` — same pattern as all other fixed templates
3. Replace all `class="detail-row"`, `class="detail-label"`, `class="detail-value"` with inline styles on each element
4. Replace `class="highlight"` with inline styles
5. Replace `class="footer"` with inline styles
6. Replace `class="button"` with inline styles
7. Add `<meta name="color-scheme" content="light">` and `<meta name="supported-color-schemes" content="light">`
8. Remove all `class="..."` attributes

**Customer confirmation email (lines 167-292):**
1. Replace `class="detail-row"`, `class="detail-label"`, `class="detail-value"` with inline styles
2. Replace `class="highlight"` with inline styles
3. Replace `class="info-box"` with inline styles
4. Replace `class="footer"` with inline styles

### No Changes To
- Email content, data, recipient logic, property access filtering
- Color values (same navy #0f172a)

### After Code Changes
Deploy the edge function.

