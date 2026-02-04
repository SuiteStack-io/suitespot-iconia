

## Create Channex Shared Utility File

### Overview

Create a shared utility file that all your Channex edge functions will use. This file provides two helper functions: one for making API calls to Channex, and another for logging those calls to your database.

---

### New File

**File:** `supabase/functions/_shared/channex-client.ts`

This shared file will contain:

1. **Environment Variable Reading**
   - `CHANNEX_API_KEY` - Your Channex API key for authentication
   - `CHANNEX_BASE_URL` - Either staging (`https://staging.channex.io`) or production (`https://app.channex.io`)

2. **`channexRequest` Function**
   - Makes HTTP requests to the Channex API
   - Automatically adds required headers (`user-api-key`, `Content-Type`)
   - Parses JSON responses
   - Throws descriptive errors when requests fail

3. **`logSync` Function**
   - Logs every API call to the `channex_sync_logs` table
   - Uses the service role client to bypass RLS policies
   - Records success/failure, request/response data, and any errors

---

### Required Secrets

Before this utility can work, you'll need to add two secrets:

| Secret Name | Description | Example Value |
|------------|-------------|---------------|
| `CHANNEX_API_KEY` | Your Channex API key | `abc123...` |
| `CHANNEX_BASE_URL` | Channex environment URL | `https://app.channex.io` |

---

### How the Utility Works

```text
Your Edge Function
       │
       ▼
┌─────────────────────────────────┐
│   channexRequest(...)           │
│   - Reads API key from env      │
│   - Adds authentication header  │
│   - Makes HTTP request          │
│   - Parses response             │
└─────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│   logSync(...)                  │
│   - Records to database         │
│   - Stores request/response     │
│   - Logs any errors             │
└─────────────────────────────────┘
```

---

### Code Structure

The file will include:

```typescript
// 1. Read environment variables
const CHANNEX_API_KEY = Deno.env.get('CHANNEX_API_KEY');
const CHANNEX_BASE_URL = Deno.env.get('CHANNEX_BASE_URL');

// 2. Helper to make Channex API requests
export async function channexRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  body?: object
): Promise<T> {
  // Adds headers, makes request, returns parsed JSON
}

// 3. Helper to log API calls to database
export async function logSync(
  functionName: string,
  endpoint: string,
  requestPayload: object | null,
  responsePayload: object | null,
  statusCode: number | null,
  success: boolean,
  errorMessage: string | null,
  propertyId: string | null
): Promise<void> {
  // Inserts record into channex_sync_logs table
}
```

---

### Usage Example

When you create other Channex edge functions, they'll import from this shared file:

```typescript
// In any Channex edge function
import { channexRequest, logSync } from '../_shared/channex-client.ts';

// Make a request to Channex
const properties = await channexRequest('GET', '/api/v1/properties');

// Log the operation
await logSync(
  'sync-properties',           // Function name
  '/api/v1/properties',        // Endpoint called
  null,                        // Request body (none for GET)
  properties,                  // Response received
  200,                         // HTTP status
  true,                        // Success?
  null,                        // Error message (none)
  null                         // Property ID (optional)
);
```

---

### File Summary

| File | Action |
|------|--------|
| `supabase/functions/_shared/channex-client.ts` | Create new shared utility file |

