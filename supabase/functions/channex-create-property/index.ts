/**
 * Channex Create Property Edge Function
 * 
 * Creates a property in Channex by taking a local property ID,
 * looking it up in the database, and sending it to Channex API.
 * 
 * POST /channex-create-property
 * Body: { "property_id": "uuid-of-your-local-property" }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { channexRequest, logSync } from "../_shared/channex-client.ts";
import { getPropertySettings } from "../_shared/property-settings.ts";

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Supabase credentials
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const functionName = 'channex-create-property';
  
  try {
    // =========================================================================
    // 1. VALIDATE HTTP METHOD
    // =========================================================================
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed. Use POST.' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // 2. AUTHENTICATE USER
    // =========================================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[Auth] No authorization header provided');
      return new Response(
        JSON.stringify({ success: false, error: 'No authorization header provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token to verify identity
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      console.error('[Auth] Invalid or expired token:', authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Auth] User authenticated: ${user.id}`);

    // =========================================================================
    // 3. CHECK IF USER IS ADMIN
    // =========================================================================
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError) {
      console.error('[Auth] Error checking user role:', roleError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Error verifying permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userRole) {
      console.error('[Auth] User is not an admin:', user.id);
      return new Response(
        JSON.stringify({ success: false, error: 'Only admins can sync properties to Channex' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Auth] Admin access confirmed');

    // =========================================================================
    // 4. PARSE REQUEST BODY
    // =========================================================================
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { property_id } = body;

    if (!property_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'property_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Property] Looking up property: ${property_id}`);

    // =========================================================================
    // 5. LOOK UP PROPERTY IN DATABASE
    // =========================================================================
    const { data: property, error: propertyError } = await supabaseAdmin
      .from('units')
      .select('*')
      .eq('id', property_id)
      .maybeSingle();

    if (propertyError) {
      console.error('[Property] Database error:', propertyError.message);
      await logSync(functionName, '/api/v1/properties', { property_id }, null, null, false, propertyError.message, property_id);
      return new Response(
        JSON.stringify({ success: false, error: 'Database error looking up property' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!property) {
      console.error('[Property] Property not found:', property_id);
      await logSync(functionName, '/api/v1/properties', { property_id }, null, null, false, 'Property not found in database', property_id);
      return new Response(
        JSON.stringify({ success: false, error: 'Property not found in database' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Property] Found property: ${property.name}`);

    // =========================================================================
    // 6. CHECK IF ALREADY MAPPED TO CHANNEX
    // =========================================================================
    const { data: existingMapping, error: mappingError } = await supabaseAdmin
      .from('channex_mappings')
      .select('channex_id')
      .eq('local_id', property_id)
      .eq('entity_type', 'property')
      .maybeSingle();

    if (mappingError) {
      console.error('[Mapping] Error checking existing mapping:', mappingError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Error checking existing Channex mapping' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingMapping) {
      console.log('[Mapping] Property already mapped to Channex:', existingMapping.channex_id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Property is already mapped to Channex',
          channex_property_id: existingMapping.channex_id
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // 7. TRANSFORM DATA TO CHANNEX FORMAT (use per-property settings)
    // =========================================================================
    const settings = await getPropertySettings(supabaseAdmin, property_id);

    const channexEmail = settings.support_email || settings.from_email_reservations || settings.email;
    const channexPhone = settings.support_phone || settings.phone;
    const channexZip = settings.zip_code;
    const channexCity = settings.city || (property as any).location || '';
    const channexAddress = settings.address || property.address || '';
    const channexCountry = settings.country || 'EG';
    const channexTimezone = settings.timezone || 'UTC';
    const channexCurrency = settings.currency || 'USD';

    // Validate required fields
    const missing: string[] = [];
    if (!channexEmail) missing.push('email');
    if (!channexPhone) missing.push('phone');
    if (!channexZip) missing.push('zip_code');
    if (!channexCity) missing.push('city');
    if (!channexAddress) missing.push('address');

    if (missing.length > 0) {
      const message = `Cannot create Channex property — missing required property settings: ${missing.join(', ')}. Please complete the property settings (Email, Contact Information, Address) before syncing.`;
      console.error('[Property] ' + message);
      await logSync(functionName, '/api/v1/properties', { property_id }, null, null, false, message, property_id);
      return new Response(
        JSON.stringify({ success: false, error: message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const channexPropertyData = {
      property: {
        title: property.name,
        currency: channexCurrency,
        email: channexEmail,
        phone: channexPhone,
        country: channexCountry,
        city: channexCity,
        address: channexAddress,
        zip_code: channexZip,
        timezone: channexTimezone,
        latitude: settings.latitude ?? property.latitude ?? null,
        longitude: settings.longitude ?? property.longitude ?? null,
        content: {
          description: (property as any).map_description || property.name || ''
        }
      }
    };

    console.log('[Channex] Sending property data:', JSON.stringify(channexPropertyData, null, 2));

    // =========================================================================
    // 8. CREATE PROPERTY IN CHANNEX
    // =========================================================================
    let channexResponse;
    try {
      channexResponse = await channexRequest<{ data: { id: string; attributes: object } }>(
        'POST',
        '/api/v1/properties',
        channexPropertyData
      );
    } catch (apiError) {
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown Channex API error';
      console.error('[Channex] API error:', errorMessage);
      await logSync(functionName, '/api/v1/properties', channexPropertyData, null, null, false, errorMessage, property_id);
      return new Response(
        JSON.stringify({ success: false, error: `Channex API error: ${errorMessage}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const channexPropertyId = channexResponse.data.id;
    console.log('[Channex] Property created successfully:', channexPropertyId);

    // =========================================================================
    // 9. SAVE MAPPING TO DATABASE
    // =========================================================================
    const { error: insertError } = await supabaseAdmin
      .from('channex_mappings')
      .insert({
        local_id: property_id,
        channex_id: channexPropertyId,
        entity_type: 'property',
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        channex_data: channexResponse.data
      });

    if (insertError) {
      console.error('[Mapping] Error saving mapping:', insertError.message);
      // Still return success since Channex property was created
      // The mapping can be added manually later
    } else {
      console.log('[Mapping] Mapping saved successfully');
    }

    // =========================================================================
    // 10. LOG SUCCESS AND RETURN
    // =========================================================================
    await logSync(
      functionName,
      '/api/v1/properties',
      channexPropertyData,
      channexResponse,
      200,
      true,
      null,
      property_id
    );

    return new Response(
      JSON.stringify({
        success: true,
        channex_property_id: channexPropertyId,
        message: 'Property created successfully in Channex'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Error] Unexpected error:', errorMessage);
    
    await logSync(functionName, '/api/v1/properties', null, null, null, false, errorMessage, null);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
