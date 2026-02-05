/**
 * Channex Create Rate Plan Edge Function
 * 
 * Creates a rate plan in Channex by taking local IDs,
 * looking them up in the database, and sending to Channex API.
 * 
 * POST /channex-create-rate-plan
 * Body: { 
 *   "rate_plan_id": "uuid-of-local-rate-plan",
 *   "room_type_id": "uuid-of-local-room-type",
 *   "property_id": "uuid-of-local-property"
 * }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { channexRequest, logSync } from "../_shared/channex-client.ts";

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

  const functionName = 'channex-create-rate-plan';
  
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
        JSON.stringify({ success: false, error: 'Only admins can sync rate plans to Channex' }),
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

    const { rate_plan_id, room_type_id, property_id } = body;

    if (!rate_plan_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'rate_plan_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!room_type_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'room_type_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!property_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'property_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[RatePlan] Processing rate plan: ${rate_plan_id}`);

    // =========================================================================
    // 5. LOOK UP CHANNEX PROPERTY ID
    // =========================================================================
    const { data: propertyMapping, error: propertyMappingError } = await supabaseAdmin
      .from('channex_mappings')
      .select('channex_id')
      .eq('local_id', property_id)
      .eq('entity_type', 'property')
      .maybeSingle();

    if (propertyMappingError) {
      console.error('[Mapping] Error looking up property mapping:', propertyMappingError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Error looking up property mapping' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!propertyMapping) {
      console.error('[Mapping] Property not synced to Channex:', property_id);
      await logSync(functionName, '/api/v1/rate_plans', body, null, null, false, 'Property must be synced to Channex first', rate_plan_id);
      return new Response(
        JSON.stringify({ success: false, error: 'Property must be synced to Channex first' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const channexPropertyId = propertyMapping.channex_id;
    console.log(`[Mapping] Found Channex property ID: ${channexPropertyId}`);

    // =========================================================================
    // 6. LOOK UP CHANNEX ROOM TYPE ID
    // =========================================================================
    const { data: roomTypeMapping, error: roomTypeMappingError } = await supabaseAdmin
      .from('channex_mappings')
      .select('channex_id')
      .eq('local_id', room_type_id)
      .eq('entity_type', 'room_type')
      .maybeSingle();

    if (roomTypeMappingError) {
      console.error('[Mapping] Error looking up room type mapping:', roomTypeMappingError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Error looking up room type mapping' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!roomTypeMapping) {
      console.error('[Mapping] Room type not synced to Channex:', room_type_id);
      await logSync(functionName, '/api/v1/rate_plans', body, null, null, false, 'Room type must be synced to Channex first', rate_plan_id);
      return new Response(
        JSON.stringify({ success: false, error: 'Room type must be synced to Channex first' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const channexRoomTypeId = roomTypeMapping.channex_id;
    console.log(`[Mapping] Found Channex room type ID: ${channexRoomTypeId}`);

    // =========================================================================
    // 7. LOOK UP RATE PLAN DETAILS
    // =========================================================================
    const { data: ratePlan, error: ratePlanError } = await supabaseAdmin
      .from('rate_plans')
      .select('*')
      .eq('id', rate_plan_id)
      .maybeSingle();

    if (ratePlanError) {
      console.error('[RatePlan] Database error:', ratePlanError.message);
      await logSync(functionName, '/api/v1/rate_plans', body, null, null, false, ratePlanError.message, rate_plan_id);
      return new Response(
        JSON.stringify({ success: false, error: 'Database error looking up rate plan' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!ratePlan) {
      console.error('[RatePlan] Rate plan not found:', rate_plan_id);
      await logSync(functionName, '/api/v1/rate_plans', body, null, null, false, 'Rate plan not found in database', rate_plan_id);
      return new Response(
        JSON.stringify({ success: false, error: 'Rate plan not found in database' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[RatePlan] Found rate plan: ${ratePlan.name}`);

    // =========================================================================
    // 7b. LOOK UP RATE PLAN PRICE FOR OCCUPANCY
    // =========================================================================
    const { data: ratePrice, error: ratePriceError } = await supabaseAdmin
      .from('rate_plan_prices')
      .select('base_occupancy')
      .eq('rate_plan_id', rate_plan_id)
      .limit(1)
      .maybeSingle();

    if (ratePriceError) {
      console.error('[RatePlan] Error looking up rate price:', ratePriceError.message);
      // Non-fatal, we'll use default occupancy
    }

    const baseOccupancy = ratePrice?.base_occupancy || 2;
    console.log(`[RatePlan] Using base occupancy: ${baseOccupancy}`);

    // =========================================================================
    // 8. CHECK IF ALREADY MAPPED TO CHANNEX
    // =========================================================================
    const { data: existingMapping, error: mappingError } = await supabaseAdmin
      .from('channex_mappings')
      .select('channex_id')
      .eq('local_id', rate_plan_id)
      .eq('entity_type', 'rate_plan')
      .maybeSingle();

    if (mappingError) {
      console.error('[Mapping] Error checking existing mapping:', mappingError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Error checking existing Channex mapping' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingMapping) {
      console.log('[Mapping] Rate plan already mapped to Channex:', existingMapping.channex_id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rate plan is already mapped to Channex',
          channex_rate_plan_id: existingMapping.channex_id
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // 9. TRANSFORM DATA TO CHANNEX FORMAT
    // =========================================================================
    const channexRatePlanData = {
      rate_plan: {
        title: ratePlan.name,
        property_id: channexPropertyId,
        room_type_id: channexRoomTypeId,
        currency: ratePlan.currency || 'USD',
        sell_mode: ratePlan.sell_mode || 'per_room',
        rate_mode: 'manual',
        options: [
          {
            occupancy: baseOccupancy,
            is_primary: true,
            rate: 0
          }
        ]
      }
    };

    console.log('[Channex] Sending rate plan data:', JSON.stringify(channexRatePlanData, null, 2));

    // =========================================================================
    // 10. CREATE RATE PLAN IN CHANNEX
    // =========================================================================
    let channexResponse;
    try {
      channexResponse = await channexRequest<{ data: { id: string; attributes: object } }>(
        'POST',
        '/api/v1/rate_plans',
        channexRatePlanData
      );
    } catch (apiError) {
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown Channex API error';
      console.error('[Channex] API error:', errorMessage);
      await logSync(functionName, '/api/v1/rate_plans', channexRatePlanData, null, null, false, errorMessage, rate_plan_id);
      return new Response(
        JSON.stringify({ success: false, error: `Channex API error: ${errorMessage}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const channexRatePlanId = channexResponse.data.id;
    console.log('[Channex] Rate plan created successfully:', channexRatePlanId);

    // =========================================================================
    // 11. SAVE MAPPING TO DATABASE
    // =========================================================================
    const { error: insertError } = await supabaseAdmin
      .from('channex_mappings')
      .insert({
        local_id: rate_plan_id,
        channex_id: channexRatePlanId,
        entity_type: 'rate_plan',
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        channex_data: channexResponse.data
      });

    if (insertError) {
      console.error('[Mapping] Error saving mapping:', insertError.message);
      // Still return success since Channex rate plan was created
    } else {
      console.log('[Mapping] Mapping saved successfully');
    }

    // =========================================================================
    // 12. LOG SUCCESS AND RETURN
    // =========================================================================
    await logSync(
      functionName,
      '/api/v1/rate_plans',
      channexRatePlanData,
      channexResponse,
      200,
      true,
      null,
      rate_plan_id
    );

    return new Response(
      JSON.stringify({
        success: true,
        channex_rate_plan_id: channexRatePlanId,
        message: 'Rate plan created successfully in Channex'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Error] Unexpected error:', errorMessage);
    
    await logSync(functionName, '/api/v1/rate_plans', null, null, null, false, errorMessage, null);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
