/**
 * Channex Reset Sync
 * 
 * Supports multiple reset modes:
 * - "full": Delete from Channex API, clear mappings, optionally clear logs/bookings, reset config
 * - "mappings_only": Clear mappings table only (no Channex API calls)
 * - "logs_only": Clear sync logs only
 * - "single": Delete a single mapping by ID (also deletes from Channex if property)
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

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'full';

    // ── MODE: logs_only ──
    if (mode === 'logs_only') {
      const { error } = await supabaseAdmin.from('channex_sync_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, mode: 'logs_only', message: 'Sync logs cleared' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── MODE: mappings_only ──
    if (mode === 'mappings_only') {
      const { error } = await supabaseAdmin.from('channex_mappings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      await supabaseAdmin.from('channex_property_config').update({ channex_property_id: null }).neq('id', '00000000-0000-0000-0000-000000000000');
      return new Response(JSON.stringify({ success: true, mode: 'mappings_only', message: 'All mappings cleared' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── MODE: single ──
    if (mode === 'single') {
      const mappingId = body.mapping_id;
      if (!mappingId) {
        return new Response(JSON.stringify({ error: 'mapping_id is required for single mode' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: mapping, error: fetchErr } = await supabaseAdmin.from('channex_mappings').select('*').eq('id', mappingId).maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!mapping) {
        return new Response(JSON.stringify({ error: 'Mapping not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Try to delete from Channex API
      let channexDeleted = false;
      try {
        const endpoint = mapping.entity_type === 'property' ? `/api/v1/properties/${mapping.channex_id}`
          : mapping.entity_type === 'room_type' ? `/api/v1/room_types/${mapping.channex_id}`
          : `/api/v1/rate_plans/${mapping.channex_id}`;
        await channexRequest('DELETE', endpoint);
        channexDeleted = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('404')) channexDeleted = true; // already gone
        else console.warn(`[Reset] Channex delete failed for ${mapping.channex_id}: ${msg}`);
      }

      const { error: delErr } = await supabaseAdmin.from('channex_mappings').delete().eq('id', mappingId);
      if (delErr) throw delErr;

      // If we deleted a property mapping, clear the config
      if (mapping.entity_type === 'property') {
        await supabaseAdmin.from('channex_property_config').update({ channex_property_id: null }).neq('id', '00000000-0000-0000-0000-000000000000');
      }

      return new Response(JSON.stringify({ success: true, mode: 'single', channex_deleted: channexDeleted, entity_type: mapping.entity_type }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── MODE: full (default) ──
    const includeLogs = body.include_logs !== false; // default true
    const includeBookings = body.include_bookings !== false; // default true

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
        if (!msg.includes('404')) {
          deleteErrors.push(`Property ${m.channex_id}: ${msg}`);
        } else {
          deletedCount++;
        }
      }
    }

    // Clear all mappings
    const { error: clearErr } = await supabaseAdmin.from('channex_mappings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (clearErr) deleteErrors.push(`Clear mappings: ${clearErr.message}`);

    // Optionally clear logs
    if (includeLogs) {
      const { error } = await supabaseAdmin.from('channex_sync_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) deleteErrors.push(`Clear logs: ${error.message}`);
    }

    // Optionally clear bookings
    if (includeBookings) {
      const { error } = await supabaseAdmin.from('channex_bookings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) deleteErrors.push(`Clear bookings: ${error.message}`);
    }

    // Reset channex_property_id in config
    await supabaseAdmin.from('channex_property_config').update({ channex_property_id: null }).neq('id', '00000000-0000-0000-0000-000000000000');

    console.log(`[Reset] Complete. Deleted ${deletedCount} properties. Errors: ${deleteErrors.length}`);

    return new Response(JSON.stringify({
      success: true,
      mode: 'full',
      deleted_count: deletedCount,
      logs_cleared: includeLogs,
      bookings_cleared: includeBookings,
      errors: deleteErrors,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
