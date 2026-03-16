

## Automated Summary Reports — Daily, Weekly, Monthly

### Scope
Create three Edge Functions and supporting infrastructure for automated email reports with PDF attachments, triggered by a single daily cron job at 06:00 UTC.

---

### 1. Database Changes (Migration)

**Create `summary_report_log` table:**
```sql
CREATE TABLE summary_report_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL,         -- 'daily', 'weekly', 'monthly'
  property_id uuid REFERENCES properties(id),
  report_date date NOT NULL,
  recipients text[] DEFAULT '{}',
  pdf_url text,
  status text NOT NULL DEFAULT 'pending',  -- 'sent', 'partial', 'failed'
  error_message text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE summary_report_log ENABLE ROW LEVEL SECURITY;
-- Admin-only read
CREATE POLICY "Admins can view report logs" ON summary_report_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

**Create `reports` storage bucket** (private) for temporary PDF storage.

---

### 2. Edge Functions

All three functions follow the same pattern: query data → generate HTML email → generate PDF (jsPDF via esm.sh) → upload PDF to `reports` bucket → send email via Resend with base64 PDF attachment → log to `summary_report_log`.

**Recipients logic (shared):**
- Query `user_notification_settings` WHERE `daily_summary_email = true`
- Join with `profiles` and `auth.users` (via `get_all_users_with_emails` RPC or service-role admin API) to get email addresses
- Skip users without email, log as "Skipped — no email"
- If no recipients, log "No recipients configured" and return early

#### `generate-daily-summary`
- Get default property (or property passed in body)
- Query today's check-ins: `reservations` WHERE `check_in_date = today`, `status IN ('confirmed','checked-in')`, join `units!unit_id` for room name
- Query today's check-outs: `reservations` WHERE `check_out_date = today`, `status IN ('confirmed','checked-in','checked-out','completed')`
- Occupancy: count units with `status = 'available'`, count reservations where `check_in_date <= today AND check_out_date > today AND status IN ('confirmed','checked-in')` — matching Analytics.tsx logic
- **Orchestration**: After sending daily, check:
  - If today is Thursday (day 4) → invoke `generate-weekly-summary`
  - If today is last working day of month (Sun-Thu = working days; if last calendar day is Fri/Sat, use preceding Thursday) → invoke `generate-monthly-summary`

#### `generate-weekly-summary`
- Period: last Thursday to this Wednesday
- Aggregated check-ins/check-outs by source
- Average daily occupancy across the week (calculate per day, average)
- Highest/lowest occupancy days
- Room nights sold vs available (total units × 7 days minus blocked dates)
- New bookings created during the week (`created_at` in range)

#### `generate-monthly-summary`
- Period: 1st to last day of current month
- Check-ins/check-outs by source with percentages
- Occupancy: average, room nights sold/available
- **Revenue** (replicating Analytics.tsx exactly):
  - Gross: `SUM(total_price)` from reservations WHERE `status != 'Cancelled'` AND `cancelled_at IS NULL` AND `check_in_date` within month range, filtered by property_id
  - Commission: `SUM(commission_amount)` from same set
  - Net: `SUM(total_price - commission_amount)` — dynamic calculation per business rule
- **Comparisons**: Query prior month and same month last year using identical logic, compute percentage changes with ↑/↓ arrows
- Bookings: total, by source, avg booking value (`AVG(total_price)`), avg length of stay (`AVG(nights)`)

---

### 3. PDF Generation

Use `jspdf` imported as `https://esm.sh/jspdf@2.5.2` in Edge Functions.

Layout per report type:
- **Header**: "SuiteSpot" + report type + property name + date/period
- **Sections**: Check-ins table, Check-outs table, Occupancy stats, Revenue (monthly only)
- **Tables**: Alternating row colors (#f9fafb / white), light borders
- **Footer**: "Generated automatically by SuiteSpot PMS — [timestamp]"

Upload PDF to `reports` bucket, attach to email as base64 via Resend's `attachments` array.

---

### 4. Email Format

- Sender: `SuiteSpot Reports <frontdesk@bookings.suitespoteg.com>`
- Subjects:
  - Daily: `Daily Summary — [Property Name] — Mon, Mar 16, 2026`
  - Weekly: `Weekly Summary — [Property Name] — Week of Mar 10 to Mar 16, 2026`
  - Monthly: `Monthly Summary — [Property Name] — March 2026`
- Body: Clean HTML with sections and tables matching the PDF content
- PDF attached with filename like `Daily-Summary-2026-03-16.pdf`
- 600ms delay between recipients (existing pattern)

---

### 5. Cron Job

Single `pg_cron` job at `0 6 * * *` (06:00 UTC = 08:00 Cairo) calling `generate-daily-summary`. The function handles weekly/monthly orchestration internally.

A second weekly cron job to clean up PDFs older than 30 days from the `reports` bucket.

---

### 6. Config Changes

Add to `supabase/config.toml`:
```toml
[functions.generate-daily-summary]
verify_jwt = false

[functions.generate-weekly-summary]
verify_jwt = false

[functions.generate-monthly-summary]
verify_jwt = false
```

---

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/generate-daily-summary/index.ts` | Create |
| `supabase/functions/generate-weekly-summary/index.ts` | Create |
| `supabase/functions/generate-monthly-summary/index.ts` | Create |
| `supabase/config.toml` | Add 3 function entries |
| Migration SQL | Create `summary_report_log` table |
| Insert SQL (not migration) | Create `reports` bucket, cron jobs |

### What is NOT Changed
- No existing edge functions, cron jobs, or email functions modified
- No changes to Analytics/Commissions page logic — only reads same data
- No changes to `user_notification_settings` table structure
- Revenue uses identical query pattern as Analytics.tsx (lines 235-245)

