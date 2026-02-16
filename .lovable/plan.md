

## Channex Error Handling, Alerts, and Health Check

### Overview

This plan adds four major improvements to the Channex integration: retry logic with exponential backoff in the shared API client, an alerts system with a database table and UI, and a health check edge function.

---

### 1. Retry Logic in Shared Client

**File:** `supabase/functions/_shared/channex-client.ts`

Update the `channexRequest` function to automatically retry on temporary errors (HTTP 500, 502, 503, 504, and network timeouts). Uses exponential backoff: 1s, 2s, 4s. Permanent errors (400, 401, 403, 404) fail immediately.

**Changes:**
- Add a `MAX_RETRIES = 3` constant and backoff delays `[1000, 2000, 4000]`
- Extract the status code from the response before throwing
- Wrap the fetch call in a retry loop
- On retryable errors, wait and retry; on permanent errors, throw immediately
- Add a new exported function `createAlert()` that inserts into `channex_alerts`

```text
channexRequest() {
  for (attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      response = await fetch(url, options);
      if (response.ok) return response.json();
      
      statusCode = response.status;
      errorBody = await response.text();
      
      if ([500, 502, 503, 504].includes(statusCode) && attempt < MAX_RETRIES) {
        console.log(`Retrying in ${delays[attempt]}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await delay(delays[attempt]);
        continue;
      }
      
      // Permanent error or last retry - throw
      throw new ChannexApiError(message, statusCode);
    } catch (networkError) {
      if (attempt < MAX_RETRIES) {
        await delay(delays[attempt]);
        continue;
      }
      throw networkError;
    }
  }
}
```

- Add a custom `ChannexApiError` class that includes `statusCode` for callers to inspect
- Add `createAlert(alertType, message, propertyId?)` helper that inserts into `channex_alerts`

---

### 2. Database: `channex_alerts` Table

**Migration** to create:

```text
CREATE TABLE public.channex_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,          -- 'webhook_error', 'sync_error', 'rate_limit', 'auth_error'
  message text NOT NULL,
  property_id uuid,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.channex_alerts ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage channex alerts"
  ON public.channex_alerts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- System (edge functions) can insert
CREATE POLICY "System can insert channex alerts"
  ON public.channex_alerts FOR INSERT
  WITH CHECK (true);
```

---

### 3. Update Edge Functions to Create Alerts

**`channex-booking-webhook`**: On DB error saving a booking, call `createAlert('webhook_error', ...)`.

**`channex-sync-property`**: On property creation failure, call `createAlert('sync_error', ...)`.

**`channex-process-sync-queue`**: On availability/rate push failure, call `createAlert('sync_error', ...)`.

**`channex-daily-sync`**: On any errors in summary, create a single alert summarizing failures.

**Shared client (`channexRequest`)**: When a 401 is detected, auto-create an `auth_error` alert. When a 429 (rate limit) is detected, auto-create a `rate_limit` alert.

---

### 4. Alert Display on Channex Admin Page

**New file:** `src/components/channex/AlertsPanel.tsx`

- Fetches unresolved alerts from `channex_alerts` ordered by `created_at DESC`
- Displays prominently at the top of the Channex Integration page (outside the tabs, always visible)
- Each alert shows: icon based on `alert_type`, message, timestamp, and a "Resolve" button
- Resolving updates `resolved = true`, `resolved_at = now()`, `resolved_by = user.id`
- Shows count badge: "3 unresolved alerts"
- Uses destructive/warning styling (red/amber card) so it stands out
- Collapsible section that expands by default when there are unresolved alerts

**Update:** `src/pages/ChannexIntegration.tsx`
- Import and render `AlertsPanel` above the tabs section
- Add an "Alerts" tab for viewing all alerts (including resolved history) with filtering

---

### 5. Health Check Edge Function

**New file:** `supabase/functions/channex-health-check/index.ts`

No user auth needed (or optionally admin-only). Returns an overall health status.

**Checks performed:**
1. **API Connection**: Calls `channexRequest('GET', '/api/v1/properties?limit=1')` -- if it fails, `api_status = 'error'`
2. **Sync Errors**: Queries `channex_mappings` for any records with `sync_status = 'error'` -- reports count
3. **Unacknowledged Bookings**: Queries `channex_bookings` where `acknowledged = false` -- reports count
4. **Recent Failures**: Queries `channex_sync_logs` for failures in last 24 hours -- reports count
5. **Unresolved Alerts**: Queries `channex_alerts` where `resolved = false` -- reports count
6. **Queue Backlog**: Queries `channex_sync_queue` for `status = 'pending'` or `status = 'failed'` -- reports counts

**Return format:**
```text
{
  "status": "healthy" | "degraded" | "error",
  "checks": {
    "api_connection": { "status": "ok", "latency_ms": 234 },
    "sync_errors": { "status": "ok", "count": 0 },
    "unacked_bookings": { "status": "warning", "count": 3 },
    "recent_failures": { "status": "ok", "count": 0 },
    "unresolved_alerts": { "status": "warning", "count": 2 },
    "queue_backlog": { "status": "ok", "pending": 0, "failed": 0 }
  },
  "checked_at": "2026-02-16T..."
}
```

Overall status: `error` if API is down; `degraded` if any check has warnings; `healthy` otherwise.

**Config:** Add `[functions.channex-health-check] verify_jwt = false` to `supabase/config.toml`.

---

### 6. Update Connection Status UI

**Update:** `src/components/channex/ConnectionStatus.tsx`

Replace or augment the simple "Test Connection" with a call to `channex-health-check`. Display the full health dashboard:
- Green/yellow/red overall status indicator
- Individual check statuses with counts
- Last checked timestamp
- Keep the manual "Run Health Check" button

---

### Technical Summary

| Change | Type |
|--------|------|
| `channex-client.ts` - retry logic + `createAlert()` | Shared utility update |
| `channex_alerts` table + RLS | Database migration |
| Update 4 edge functions to create alerts | Edge function updates |
| `AlertsPanel.tsx` component | New frontend component |
| `ChannexIntegration.tsx` - add alerts section + tab | Frontend update |
| `channex-health-check` edge function | New edge function |
| `ConnectionStatus.tsx` - show health data | Frontend update |
| `supabase/config.toml` - add health-check config | Config update |

