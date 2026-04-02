/**
 * Channex Create Derived Rate Plan Edge Function
 * 
 * Creates a derived rate plan in Channex that inherits from a base rate plan
 * and applies a percentage markup for OTA channels.
 * 
 * POST /channex-create-derived-rate-plan
 * Body: { "base_rate_plan_id": "uuid", "channel_markup_id": "uuid" }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { channexRequest, logSync } from "../_shared/channex-client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const functionName = 'channex-create-derived-rate-plan';

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check admin role
    const { data: userRole } = await supabaseAdmin
      .from('user_roles').select('role')
      .eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!userRole) {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse body
    const body = await req.json();
    const { base_rate_plan_id, channel_markup_id } = body;

    if (!base_rate_plan_id || !channel_markup_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'base_rate_plan_id and channel_markup_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up channel markup settings
    const { data: markupSettings, error: markupError } = await supabaseAdmin
      .from('channel_markup_settings')
      .select('*')
      .eq('id', channel_markup_id)
      .maybeSingle();

    if (markupError || !markupSettings) {
      return new Response(
        JSON.stringify({ success: false, error: 'Channel markup settings not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up base rate plan
    const { data: ratePlan, error: rpError } = await supabaseAdmin
      .from('rate_plans')
      .select('*')
      .eq('id', base_rate_plan_id)
      .maybeSingle();

    if (rpError || !ratePlan) {
      return new Response(
        JSON.stringify({ success: false, error: 'Base rate plan not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up base rate plan's Channex mapping
    const { data: baseMapping } = await supabaseAdmin
      .from('channex_mappings')
      .select('channex_id')
      .eq('local_id', base_rate_plan_id)
      .eq('entity_type', 'rate_plan')
      .maybeSingle();

    if (!baseMapping) {
      return new Response(
        JSON.stringify({ success: false, error: 'Base rate plan not synced to Channex' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if derived plan already exists for this base+channel combo
    const { data: existingDerived } = await supabaseAdmin
      .from('derived_rate_plan_mappings')
      .select('id')
      .eq('base_rate_plan_id', base_rate_plan_id)
      .eq('channel_markup_id', channel_markup_id)
      .maybeSingle();

    if (existingDerived) {
      return new Response(
        JSON.stringify({ success: false, error: 'Derived rate plan already exists for this base plan and channel' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up room type Channex ID - find the unit with matching booking_com_name
    let roomTypeQuery = supabaseAdmin
      .from('units')
      .select('id')
      .eq('booking_com_name', ratePlan.room_type);
    if (ratePlan.property_id) {
      roomTypeQuery = roomTypeQuery.eq('property_id', ratePlan.property_id);
    }

    console.log('[DerivedRP] Using property_id from rate plan:', ratePlan.property_id);

    const { data: roomTypeUnit } = await roomTypeQuery.limit(1).maybeSingle();

    console.log('[DerivedRP] Room type unit found:', roomTypeUnit);

    let channexRoomTypeId: string | null = null;
    if (roomTypeUnit) {
      const { data: rtMapping } = await supabaseAdmin
        .from('channex_mappings')
        .select('channex_id')
        .eq('local_id', roomTypeUnit.id)
        .eq('entity_type', 'room_type')
        .maybeSingle();
      channexRoomTypeId = rtMapping?.channex_id || null;
    }

    // Look up property Channex ID from channex_mappings (single source of truth)
    const { data: propMapping } = await supabaseAdmin
      .from('channex_mappings')
      .select('channex_id')
      .eq('entity_type', 'property')
      .eq('sync_status', 'synced')
      .limit(1)
      .maybeSingle();

    if (!propMapping?.channex_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Property not synced to Channex' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up base occupancy from rate_plan_prices
    const { data: ratePrice } = await supabaseAdmin
      .from('rate_plan_prices')
      .select('base_occupancy')
      .eq('rate_plan_id', base_rate_plan_id)
      .limit(1)
      .maybeSingle();

    const baseOccupancy = ratePrice?.base_occupancy || 2;
    const markupPct = markupSettings.markup_percentage.toString();

    // Build Channex derived rate plan payload
    const derivedTitle = `${ratePlan.name} - ${markupSettings.channel_name}`;
    const channexPayload: Record<string, unknown> = {
      rate_plan: {
        title: derivedTitle,
        property_id: propMapping.channex_id,
        room_type_id: channexRoomTypeId,
        parent_rate_plan_id: baseMapping.channex_id,
        currency: ratePlan.currency || 'USD',
        sell_mode: ratePlan.sell_mode || 'per_room',
        rate_mode: 'derived',
        options: [
          {
            occupancy: baseOccupancy,
            is_primary: true,
            derived_option: {
              rate: [["increase_by_percent", markupPct]]
            },
            rate: 0
          }
        ],
        inherit_rate: true,
        inherit_closed_to_arrival: true,
        inherit_closed_to_departure: true,
        inherit_stop_sell: true,
        inherit_min_stay_arrival: true,
        inherit_min_stay_through: true,
        inherit_max_stay: true,
      }
    };

    console.log(`[DerivedRP] Creating derived rate plan: ${derivedTitle}`);

    // Create in Channex
    let channexResponse;
    try {
      channexResponse = await channexRequest<{ data: { id: string; attributes: object } }>(
        'POST',
        '/api/v1/rate_plans',
        channexPayload
      );
    } catch (apiError) {
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error';
      console.error('[DerivedRP] Channex API error:', errorMessage);
      await logSync(functionName, '/api/v1/rate_plans', channexPayload, null, null, false, errorMessage, null);
      return new Response(
        JSON.stringify({ success: false, error: `Channex API error: ${errorMessage}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const channexDerivedId = channexResponse.data.id;
    console.log(`[DerivedRP] Created in Channex: ${channexDerivedId}`);

    // Save to channex_mappings
    await supabaseAdmin.from('channex_mappings').insert({
      local_id: base_rate_plan_id,
      channex_id: channexDerivedId,
      entity_type: 'derived_rate_plan',
      sync_status: 'synced',
      last_synced_at: new Date().toISOString(),
      channex_data: channexResponse.data,
    });

    // Save to derived_rate_plan_mappings
    await supabaseAdmin.from('derived_rate_plan_mappings').insert({
      base_rate_plan_id,
      channel_markup_id,
      channex_base_rate_plan_id: baseMapping.channex_id,
      channex_derived_rate_plan_id: channexDerivedId,
      channel_name: markupSettings.channel_name,
      markup_percentage: markupSettings.markup_percentage,
    });

    await logSync(functionName, '/api/v1/rate_plans', channexPayload, channexResponse, 200, true, null, null);

    return new Response(
      JSON.stringify({
        success: true,
        channex_derived_rate_plan_id: channexDerivedId,
        message: `Derived rate plan "${derivedTitle}" created successfully`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DerivedRP] Error:', errorMessage);
    await logSync(functionName, '/api/v1/rate_plans', null, null, null, false, errorMessage, null);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
