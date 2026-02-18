/**
 * Channex Reset Sync
 * 
 * Deletes all synced entities from Channex (properties cascade to room types & rate plans),
 * clears channex_mappings, and resets channex_property_id in config.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { channexRequest } from "../_shared/channex-client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: role } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!role) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get all mappings
    const { data: mappings, error: mapErr } = await supabaseAdmin.from('channex_mappings').select('*');
    if (mapErr) throw mapErr;

    const deleteErrors: string[] = [];
    let deletedCount = 0;

    // Delete properties from Channex (cascades to room types and rate plans)
    const propertyMappings = (mappings || []).filter(m => m.entity_type === 'property');
    for (const m of propertyMappings) {
      try {
        await channexRequest('DELETE', `/api/v1/properties/${m.channex_id}`);
        deletedCount++;
        console.log(`[Reset] Deleted property ${m.channex_id}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // 404 means already deleted, that's fine
        if (!msg.includes('404')) {
          deleteErrors.push(`Property ${m.channex_id}: ${msg}`);
        } else {
          deletedCount++;
        }
      }
    }

    // Clear all mappings
    const { error: clearErr } = await supabaseAdmin.from('channex_mappings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (clearErr) {
      console.error('[Reset] Failed to clear mappings:', clearErr.message);
      deleteErrors.push(`Clear mappings: ${clearErr.message}`);
    }

    // Reset channex_property_id in config
    await supabaseAdmin.from('channex_property_config').update({ channex_property_id: null }).neq('id', '00000000-0000-0000-0000-000000000000');

    console.log(`[Reset] Complete. Deleted ${deletedCount} properties. Errors: ${deleteErrors.length}`);

    return new Response(JSON.stringify({
      success: true,
      deleted_count: deletedCount,
      errors: deleteErrors,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
