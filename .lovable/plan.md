

## Fix: Daily Summary Edge Function Boot Crash

### Problem
The `generate-daily-summary` function returns 404 with no logs — a classic sign of a Deno edge function boot crash. The `jsPDF` library imported via `esm.sh` likely fails to initialize in the Deno runtime (it depends on browser globals like `window` and `document`). All three summary functions (`daily`, `weekly`, `monthly`) are affected.

### Solution
Remove the `jsPDF` dependency entirely. Instead of generating a PDF at runtime in the edge function, send **only the HTML email** (which already contains all the same data). The PDF attachment is a nice-to-have but is actively preventing the function from running at all.

### Changes

**File: `supabase/functions/generate-daily-summary/index.ts`**
1. Remove the `jsPDF` import (line 3)
2. Remove the entire `generatePDF()` function (lines 113-243)
3. Remove PDF generation, upload, and attachment logic from the handler:
   - Remove `const pdfBytes = generatePDF(...)` call
   - Remove the storage upload block (`supabase.storage.from("reports").upload(...)`)
   - Remove `pdfBase64` conversion
   - Remove the `attachments` field from the Resend email send call
   - Remove `pdf_url` from the log insert (set to `null`)
4. Keep everything else: email HTML generation, recipient logic, blocked rooms, occupancy, logging

**File: `supabase/functions/generate-weekly-summary/index.ts`**
Same changes — remove jsPDF import, PDF generation, upload, and attachment.

**File: `supabase/functions/generate-monthly-summary/index.ts`**
Same changes — remove jsPDF import, PDF generation, upload, and attachment.

After editing, redeploy all three functions and trigger the daily summary to verify delivery.

### Technical Detail
- The HTML email already contains the full summary (check-ins, check-outs, blocked rooms, occupancy) — no information is lost
- PDF generation can be re-added later using a Deno-compatible library if needed
- The `reports` storage bucket and `summary_report_log` table remain intact for future use

