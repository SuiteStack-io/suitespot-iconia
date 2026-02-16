/**
 * Channex API Client - Shared Utility
 * 
 * Provides helper functions for all Channex edge functions:
 * - Authenticated API requests with retry logic
 * - Sync logging to database
 * - Alert creation for error tracking
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// ENVIRONMENT VARIABLES
// ============================================================================

const CHANNEX_API_KEY = Deno.env.get('CHANNEX_API_KEY');
const CHANNEX_BASE_URL = Deno.env.get('CHANNEX_BASE_URL');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ============================================================================
// RETRY CONFIGURATION
// ============================================================================

const MAX_RETRIES = 3;
const BACKOFF_DELAYS = [1000, 2000, 4000]; // ms
const RETRYABLE_STATUS_CODES = [500, 502, 503, 504];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ============================================================================
// CUSTOM ERROR CLASS
// ============================================================================

export class ChannexApiError extends Error {
  public statusCode: number | null;

  constructor(message: string, statusCode: number | null = null) {
    super(message);
    this.name = 'ChannexApiError';
    this.statusCode = statusCode;
  }
}

// ============================================================================
// CHANNEX API REQUEST FUNCTION (WITH RETRY)
// ============================================================================

export async function channexRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  body?: object
): Promise<T> {
  if (!CHANNEX_API_KEY) {
    throw new ChannexApiError('CHANNEX_API_KEY environment variable is not set.', null);
  }
  if (!CHANNEX_BASE_URL) {
    throw new ChannexApiError('CHANNEX_BASE_URL environment variable is not set.', null);
  }

  const url = `${CHANNEX_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'user-api-key': CHANNEX_API_KEY,
    'Content-Type': 'application/json',
  };

  const options: RequestInit = { method, headers };
  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[Channex] ${method} ${endpoint}${attempt > 0 ? ` (retry ${attempt}/${MAX_RETRIES})` : ''}`);
      const response = await fetch(url, options);

      if (response.ok) {
        const data = await response.json();
        return data as T;
      }

      const statusCode = response.status;
      let errorDetails = '';
      try {
        errorDetails = await response.text();
      } catch {
        errorDetails = 'Could not read error response';
      }

      // Auto-create alerts for specific error codes
      if (statusCode === 401) {
        await createAlert('auth_error', `Channex API authentication failed on ${method} ${endpoint}. Check your API key.`);
      } else if (statusCode === 429) {
        await createAlert('rate_limit', `Channex API rate limit exceeded on ${method} ${endpoint}.`);
      }

      // Retry on temporary errors
      if (RETRYABLE_STATUS_CODES.includes(statusCode) && attempt < MAX_RETRIES) {
        console.log(`[Channex] Retryable error ${statusCode}, waiting ${BACKOFF_DELAYS[attempt]}ms...`);
        await sleep(BACKOFF_DELAYS[attempt]);
        continue;
      }

      // Permanent error or final retry exhausted
      throw new ChannexApiError(
        `Channex API request failed: ${method} ${endpoint} returned ${statusCode} ${response.statusText}. Details: ${errorDetails}`,
        statusCode
      );
    } catch (err) {
      // If it's already our error, rethrow on last attempt
      if (err instanceof ChannexApiError) {
        if (attempt >= MAX_RETRIES) throw err;
        // For retryable ChannexApiError (server errors), continue
        if (err.statusCode && RETRYABLE_STATUS_CODES.includes(err.statusCode) && attempt < MAX_RETRIES) {
          await sleep(BACKOFF_DELAYS[attempt]);
          continue;
        }
        throw err;
      }

      // Network errors - retry
      if (attempt < MAX_RETRIES) {
        console.log(`[Channex] Network error, retrying in ${BACKOFF_DELAYS[attempt]}ms: ${(err as Error).message}`);
        await sleep(BACKOFF_DELAYS[attempt]);
        continue;
      }

      throw new ChannexApiError(`Network error on ${method} ${endpoint}: ${(err as Error).message}`, null);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new ChannexApiError(`Max retries exceeded for ${method} ${endpoint}`, null);
}

// ============================================================================
// ALERT CREATION
// ============================================================================

export async function createAlert(
  alertType: string,
  message: string,
  propertyId?: string | null
): Promise<void> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await supabase
      .from('channex_alerts')
      .insert({
        alert_type: alertType,
        message,
        property_id: propertyId || null,
      });

    if (error) {
      console.error('[Channex] Failed to create alert:', error);
    }
  } catch (err) {
    console.error('[Channex] Error in createAlert:', err);
  }
}

// ============================================================================
// SYNC LOGGING
// ============================================================================

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
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await supabase
      .from('channex_sync_logs')
      .insert({
        function_name: functionName,
        endpoint,
        request_payload: requestPayload,
        response_payload: responsePayload,
        status_code: statusCode,
        success,
        error_message: errorMessage,
        property_id: propertyId,
      });

    if (error) {
      console.error('[Channex] Failed to insert sync log:', error);
    }
  } catch (err) {
    console.error('[Channex] Error in logSync:', err);
  }
}
