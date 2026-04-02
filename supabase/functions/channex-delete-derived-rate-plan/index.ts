/**
 * Channex Delete Derived Rate Plan Edge Function
 * 
 * Deletes a derived rate plan from Channex and cleans up local mappings.
 * 
 * POST /channex-delete-derived-rate-plan
 * Body: { "derived_mapping_id": "uuid" }
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

  const functionName = 'channex-delete-derived-rate-plan';

  let resolvedPropertyId: string | null = null;

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

    const { data: userRole } = await supabaseAdmin
      .from('user_roles').select('role')
      .eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!userRole) {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { derived_mapping_id } = body;

    if (!derived_mapping_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'derived_mapping_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up the derived mapping
    const { data: mapping, error: mapError } = await supabaseAdmin
      .from('derived_rate_plan_mappings')
      .select('*')
      .eq('id', derived_mapping_id)
      .maybeSingle();

    if (mapError || !mapping) {
      return new Response(
        JSON.stringify({ success: false, error: 'Derived rate plan mapping not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: baseRp } = await supabaseAdmin
      .from('rate_plans')
      .select('property_id')
      .eq('id', mapping.base_rate_plan_id)
      .maybeSingle();
    resolvedPropertyId = baseRp?.property_id || null;

    // Delete from Channex
    try {
      await channexRequest(
        'DELETE',
        `/api/v1/rate_plans/${mapping.channex_derived_rate_plan_id}`,
      );
      console.log(`[DerivedRP] Deleted from Channex: ${mapping.channex_derived_rate_plan_id}`);
    } catch (apiError) {
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error';
      console.error('[DerivedRP] Channex delete error:', errorMessage);
      // Continue with local cleanup even if Channex delete fails (may already be deleted)
    }

    // Clean up channex_mappings
    await supabaseAdmin
      .from('channex_mappings')
      .delete()
      .eq('channex_id', mapping.channex_derived_rate_plan_id)
      .eq('entity_type', 'derived_rate_plan');

    // Clean up derived_rate_plan_mappings
    await supabaseAdmin
      .from('derived_rate_plan_mappings')
      .delete()
      .eq('id', derived_mapping_id);

    await logSync(functionName, `/api/v1/rate_plans/${mapping.channex_derived_rate_plan_id}`, { derived_mapping_id }, null, 200, true, null, null);

    return new Response(
      JSON.stringify({ success: true, message: 'Derived rate plan deleted' }),
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
