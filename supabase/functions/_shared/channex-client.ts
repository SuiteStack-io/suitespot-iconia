/**
 * Channex API Client - Shared Utility
 * 
 * This file provides helper functions for all Channex edge functions.
 * It handles API authentication, request making, and logging.
 * 
 * Required Environment Variables:
 * - CHANNEX_API_KEY: Your Channex API key for authentication
 * - CHANNEX_BASE_URL: Either https://staging.channex.io or https://app.channex.io
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// ENVIRONMENT VARIABLES
// ============================================================================

// Read the Channex API key from environment
// This key authenticates all requests to the Channex API
const CHANNEX_API_KEY = Deno.env.get('CHANNEX_API_KEY');

// Read the Channex base URL from environment
// Use https://staging.channex.io for testing, https://app.channex.io for production
const CHANNEX_BASE_URL = Deno.env.get('CHANNEX_BASE_URL');

// Supabase credentials for logging to database
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ============================================================================
// CHANNEX API REQUEST FUNCTION
// ============================================================================

/**
 * Makes an authenticated request to the Channex API
 * 
 * @param method - HTTP method: GET, POST, PUT, or DELETE
 * @param endpoint - API endpoint path (e.g., '/api/v1/properties')
 * @param body - Optional request body for POST/PUT requests
 * @returns The parsed JSON response from Channex
 * @throws Error if the API key is missing or the request fails
 * 
 * @example
 * // Fetch all properties
 * const properties = await channexRequest('GET', '/api/v1/properties');
 * 
 * @example
 * // Create a new property
 * const newProperty = await channexRequest('POST', '/api/v1/properties', {
 *   property: { title: 'My Hotel', ... }
 * });
 */
export async function channexRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  body?: object
): Promise<T> {
  // Check that we have the required configuration
  if (!CHANNEX_API_KEY) {
    throw new Error('CHANNEX_API_KEY environment variable is not set. Please add it to your secrets.');
  }
  
  if (!CHANNEX_BASE_URL) {
    throw new Error('CHANNEX_BASE_URL environment variable is not set. Please add it to your secrets.');
  }

  // Build the full URL by combining base URL and endpoint
  const url = `${CHANNEX_BASE_URL}${endpoint}`;
  
  // Prepare the request headers
  // - user-api-key: Required by Channex for authentication
  // - Content-Type: Tells Channex we're sending JSON
  const headers: Record<string, string> = {
    'user-api-key': CHANNEX_API_KEY,
    'Content-Type': 'application/json',
  };

  // Prepare request options
  const options: RequestInit = {
    method,
    headers,
  };

  // Add body for POST/PUT requests (not needed for GET/DELETE)
  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  // Make the HTTP request to Channex
  console.log(`[Channex] ${method} ${endpoint}`);
  const response = await fetch(url, options);

  // Check if the request was successful (status 200-299)
  if (!response.ok) {
    // Try to get error details from the response body
    let errorDetails = '';
    try {
      const errorBody = await response.text();
      errorDetails = errorBody;
    } catch {
      errorDetails = 'Could not read error response';
    }

    // Throw a descriptive error
    throw new Error(
      `Channex API request failed: ${method} ${endpoint} returned ${response.status} ${response.statusText}. Details: ${errorDetails}`
    );
  }

  // Parse and return the JSON response
  const data = await response.json();
  return data as T;
}

// ============================================================================
// SYNC LOGGING FUNCTION
// ============================================================================

/**
 * Logs a Channex API call to the database for auditing and debugging
 * 
 * This function records every API interaction in the channex_sync_logs table,
 * which helps with:
 * - Debugging issues when something goes wrong
 * - Auditing what API calls were made and when
 * - Tracking success/failure rates
 * 
 * @param functionName - Name of the edge function making the call (e.g., 'sync-properties')
 * @param endpoint - The Channex API endpoint that was called
 * @param requestPayload - The request body that was sent (null for GET requests)
 * @param responsePayload - The response received from Channex
 * @param statusCode - HTTP status code (200, 400, 500, etc.)
 * @param success - Whether the API call succeeded
 * @param errorMessage - Error details if the call failed (null if successful)
 * @param propertyId - Optional ID of the property this call relates to
 * 
 * @example
 * // Log a successful API call
 * await logSync(
 *   'sync-properties',
 *   '/api/v1/properties',
 *   null,
 *   responseData,
 *   200,
 *   true,
 *   null,
 *   null
 * );
 * 
 * @example
 * // Log a failed API call
 * await logSync(
 *   'push-availability',
 *   '/api/v1/availability',
 *   { dates: [...] },
 *   null,
 *   500,
 *   false,
 *   'Server error',
 *   'property-uuid-here'
 * );
 */
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
    // Create a Supabase client with service role to bypass RLS
    // This allows the edge function to write logs even without user authentication
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Insert the log record into the channex_sync_logs table
    const { error } = await supabase
      .from('channex_sync_logs')
      .insert({
        function_name: functionName,
        endpoint: endpoint,
        request_payload: requestPayload,
        response_payload: responsePayload,
        status_code: statusCode,
        success: success,
        error_message: errorMessage,
        property_id: propertyId,
      });

    // If there was an error inserting the log, just console.error it
    // We don't want logging failures to break the main functionality
    if (error) {
      console.error('[Channex] Failed to insert sync log:', error);
    }
  } catch (err) {
    // Catch any unexpected errors and log them
    console.error('[Channex] Error in logSync:', err);
  }
}
