/**
 * Channex Sync Property Edge Function (v4 - Multi-Property)
 * 
 * Accepts { propertyId } to sync a specific property from the `properties` table.
 * Falls back to `channex_property_config` if no propertyId is provided (backward compat).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { channexRequest, logSync, createAlert } from "../_shared/channex-client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface SyncError {
  entity: 'property' | 'room_type' | 'rate_plan';
  local_id: string;
  name: string;
  error: string;
}

interface RoomTypeGroup {
  unitId: string;
  displayName: string;
  max_guests: number;
  max_children: number;
  max_infants: number;
  default_occupancy: number;
  room_kind: string;
  count: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    // AUTH
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userRole } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!userRole) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Parse request body
    let propertyId: string | null = null;
    try {
      const body = await req.json();
      propertyId = body?.propertyId || null;
    } catch {
      // No body or invalid JSON — fall back to legacy mode
    }

    // STEP 0: LOAD PROPERTY CONFIG
    let propConfig: {
      id: string;
      property_name: string;
      currency: string;
      email: string;
      phone: string | null;
      zip_code: string | null;
      country: string;
      city: string;
      address: string;
      timezone: string;
      latitude: number | null;
      longitude: number | null;
      description: string | null;
    };

    if (propertyId) {
      // New multi-property mode: load from `properties` table
      const { data: property, error: propError } = await supabaseAdmin
        .from('properties')
        .select('id, name, currency, email, phone, zip_code, country, city, address, timezone, latitude, longitude, description')
        .eq('id', propertyId)
        .single();

      if (propError || !property) {
        return new Response(JSON.stringify({ error: 'Property not found.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      propConfig = {
        id: property.id,
        property_name: property.name,
        currency: property.currency || 'USD',
        email: property.email,
        phone: property.phone,
        zip_code: property.zip_code,
        country: property.country || 'EG',
        city: property.city || 'Cairo',
        address: property.address || '',
        timezone: property.timezone || 'Africa/Cairo',
        latitude: property.latitude,
        longitude: property.longitude,
        description: property.description,
      };
    } else {
      // Legacy fallback: use channex_property_config
      const { data: propertyConfig, error: configError } = await supabaseAdmin
        .from('channex_property_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (configError || !propertyConfig) {
        return new Response(JSON.stringify({ error: 'Please configure property settings first.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      propConfig = {
        id: propertyConfig.id,
        property_name: propertyConfig.property_name,
        currency: propertyConfig.currency || 'USD',
        email: propertyConfig.email,
        phone: propertyConfig.phone,
        zip_code: propertyConfig.zip_code,
        country: propertyConfig.country || 'EG',
        city: propertyConfig.city || 'Cairo',
        address: propertyConfig.address || '',
        timezone: propertyConfig.timezone || 'Africa/Cairo',
        latitude: propertyConfig.latitude,
        longitude: propertyConfig.longitude,
        description: propertyConfig.description,
      };
    }

    console.log(`[Sync] Starting sync for: ${propConfig.property_name} (${propConfig.id})`);

    const errors: SyncError[] = [];
    const roomTypeResults: { local_id: string; channex_id: string; name: string; status: string }[] = [];
    const ratePlanResults: { local_id: string; channex_id: string; name: string; status: string }[] = [];
    let channexPropertyId: string;
    let propertyStatus: string;

    // STEP 1: PROPERTY SYNC
    const { data: existingPropertyMapping } = await supabaseAdmin
      .from('channex_mappings')
      .select('channex_id')
      .eq('local_id', propConfig.id)
      .eq('entity_type', 'property')
      .maybeSingle();

    if (existingPropertyMapping) {
      channexPropertyId = existingPropertyMapping.channex_id;
      propertyStatus = 'already_synced';
      console.log(`[Property] Already synced -> ${channexPropertyId}`);
    } else {
      console.log('[Property] Creating in Channex...');
      const payload = {
        property: {
          title: propConfig.property_name,
          currency: propConfig.currency,
          email: propConfig.email,
          phone: propConfig.phone || '',
          zip_code: propConfig.zip_code || '',
          country: propConfig.country,
          state: propConfig.city,
          city: propConfig.city,
          address: propConfig.address,
          timezone: propConfig.timezone,
          facilities: [],
          latitude: propConfig.latitude || 30.0626,
          longitude: propConfig.longitude || 31.2247,
        }
      };

      try {
        const res = await channexRequest<{ data: { id: string } }>('POST', '/api/v1/properties', payload);
        channexPropertyId = res.data.id;
        console.log(`[Property] Created -> ${channexPropertyId}`);

        await supabaseAdmin.from('channex_mappings').insert({
          local_id: propConfig.id,
          channex_id: channexPropertyId,
          entity_type: 'property',
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
          channex_data: res.data,
        });

        // Update source table
        if (propertyId) {
          await supabaseAdmin.from('properties').update({
            channex_property_id: channexPropertyId,
            channex_synced: true,
            channex_last_sync: new Date().toISOString(),
          }).eq('id', propertyId);
        } else {
          await supabaseAdmin.from('channex_property_config').update({ channex_property_id: channexPropertyId }).eq('id', propConfig.id);
        }

        propertyStatus = 'created';
        await logSync('channex-sync-property', '/api/v1/properties', payload, res, 200, true, null, propConfig.id);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[Property] Failed:', msg);
        await logSync('channex-sync-property', '/api/v1/properties', payload, null, 500, false, msg, propConfig.id);
        await createAlert('sync_error', `Failed to create property: ${msg}`, propConfig.id);
        return new Response(JSON.stringify({ error: `Failed to create property: ${msg}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // STEP 2: ROOM TYPES (grouped by booking_com_name)
    // Filter by property_id if using multi-property mode, else fall back to location filter
    let unitsQuery = supabaseAdmin
      .from('units')
      .select('id, name, booking_com_name, max_guests, max_children, max_infants, default_occupancy, room_kind')
      .or('is_private.eq.false,is_private.is.null');

    if (propertyId) {
      unitsQuery = unitsQuery.eq('property_id', propertyId);
    } else {
      throw new Error('property_id is required for syncing units');
    }

    console.log('[SyncProperty] Using property_id:', propertyId);

    const { data: units, error: unitsError } = await unitsQuery;

    console.log('[SyncProperty] Units found:', units?.length, units?.map(u => ({ id: u.id, name: u.booking_com_name || u.name })));

    if (unitsError) {
      errors.push({ entity: 'room_type', local_id: 'all', name: 'All', error: unitsError.message });
    } else if (units && units.length > 0) {
      const groups: Record<string, RoomTypeGroup> = {};
      for (const u of units) {
        const name = u.booking_com_name || u.name;
        if (!groups[name]) {
          groups[name] = {
            unitId: u.id,
            displayName: name,
            max_guests: u.max_guests || 2,
            max_children: u.max_children || 0,
            max_infants: u.max_infants || 0,
            default_occupancy: u.default_occupancy || 2,
            room_kind: u.room_kind || 'room',
            count: 0,
          };
        }
        groups[name].count++;
      }

      console.log(`[RoomTypes] ${Object.keys(groups).length} unique room types`);

      for (const [displayName, rt] of Object.entries(groups)) {
        try {
          const { data: existing } = await supabaseAdmin.from('channex_mappings').select('channex_id').eq('local_id', rt.unitId).eq('entity_type', 'room_type').maybeSingle();

          if (existing) {
            roomTypeResults.push({ local_id: rt.unitId, channex_id: existing.channex_id, name: displayName, status: 'already_synced' });
            continue;
          }

          const payload = {
            room_type: {
              title: displayName,
              property_id: channexPropertyId,
              count_of_rooms: rt.count,
              occ_adults: rt.max_guests,
              occ_children: rt.max_children,
              occ_infants: rt.max_infants,
              default_occupancy: rt.default_occupancy,
              kind: rt.room_kind,
            }
          };

          const res = await channexRequest<{ data: { id: string } }>('POST', '/api/v1/room_types', payload);
          const channexRtId = res.data.id;
          console.log(`[RoomTypes] Created: ${displayName} -> ${channexRtId} (${rt.count} rooms)`);

          await supabaseAdmin.from('channex_mappings').insert({
            local_id: rt.unitId,
            channex_id: channexRtId,
            entity_type: 'room_type',
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
            channex_data: res.data,
          });

          roomTypeResults.push({ local_id: rt.unitId, channex_id: channexRtId, name: displayName, status: 'created' });
          await logSync('channex-sync-property', '/api/v1/room_types', payload, res, 200, true, null, propConfig.id);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          errors.push({ entity: 'room_type', local_id: rt.unitId, name: displayName, error: msg });
        }
      }
    }

    // STEP 3: RATE PLANS (1-to-1 mapping via rate_plans.room_type)
    let ratePlansQuery = supabaseAdmin
      .from('rate_plans')
      .select('id, name, currency, sell_mode, room_type, is_active')
      .eq('is_active', true)
      .not('room_type', 'is', null);

    if (propertyId) {
      ratePlansQuery = ratePlansQuery.eq('property_id', propertyId);
    }

    const { data: ratePlans } = await ratePlansQuery;

    console.log('[SyncProperty] Rate plans found:', ratePlans?.length, ratePlans?.map(rp => ({ id: rp.id, name: rp.name, room_type: rp.room_type })));

    if (ratePlans && ratePlans.length > 0) {
      const rtLookup: Record<string, string> = {};
      for (const result of roomTypeResults) {
        rtLookup[result.name] = result.channex_id;
      }
      if (units) {
        const groups: Record<string, string> = {};
        for (const u of units) {
          const name = u.booking_com_name || u.name;
          if (!groups[name]) groups[name] = u.id;
        }
        for (const [name, unitId] of Object.entries(groups)) {
          if (!rtLookup[name]) {
            const { data: mapping } = await supabaseAdmin.from('channex_mappings').select('channex_id').eq('local_id', unitId).eq('entity_type', 'room_type').maybeSingle();
            if (mapping) rtLookup[name] = mapping.channex_id;
          }
        }
      }

      for (const rp of ratePlans) {
        try {
          const { data: existing } = await supabaseAdmin.from('channex_mappings').select('channex_id').eq('local_id', rp.id).eq('entity_type', 'rate_plan').maybeSingle();

          if (existing) {
            ratePlanResults.push({ local_id: rp.id, channex_id: existing.channex_id, name: rp.name, status: 'already_synced' });
            continue;
          }

          const channexRtId = rp.room_type ? rtLookup[rp.room_type] : null;
          if (!channexRtId) {
            errors.push({ entity: 'rate_plan', local_id: rp.id, name: rp.name, error: `No synced room type found for "${rp.room_type}"` });
            continue;
          }

          const { data: ratePrice } = await supabaseAdmin.from('rate_plan_prices').select('base_occupancy').eq('rate_plan_id', rp.id).limit(1).maybeSingle();

          const payload = {
            rate_plan: {
              title: rp.name,
              property_id: channexPropertyId,
              room_type_id: channexRtId,
              currency: rp.currency || 'USD',
              sell_mode: rp.sell_mode || 'per_room',
              rate_mode: 'manual',
              options: [{ occupancy: ratePrice?.base_occupancy || 2, is_primary: true, rate: 0 }]
            }
          };

          const res = await channexRequest<{ data: { id: string } }>('POST', '/api/v1/rate_plans', payload);
          console.log(`[RatePlans] Created: ${rp.name} -> ${res.data.id} (room_type: ${rp.room_type})`);

          await supabaseAdmin.from('channex_mappings').insert({
            local_id: rp.id,
            channex_id: res.data.id,
            entity_type: 'rate_plan',
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
            channex_data: res.data,
          });

          ratePlanResults.push({ local_id: rp.id, channex_id: res.data.id, name: rp.name, status: 'created' });
          await logSync('channex-sync-property', '/api/v1/rate_plans', payload, res, 200, true, null, propConfig.id);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          errors.push({ entity: 'rate_plan', local_id: rp.id, name: rp.name, error: msg });
        }
      }
    }

    // Update channex_last_sync on the properties table
    if (propertyId) {
      await supabaseAdmin.from('properties').update({
        channex_last_sync: new Date().toISOString(),
        channex_synced: true,
      }).eq('id', propertyId);
    }

    // SUMMARY
    console.log(`[Sync] Done. RT: ${roomTypeResults.length}, RP: ${ratePlanResults.length}, Errors: ${errors.length}`);

    return new Response(JSON.stringify({
      success: true,
      property: { local_id: propConfig.id, channex_id: channexPropertyId, status: propertyStatus },
      room_types: roomTypeResults,
      rate_plans: ratePlanResults,
      errors
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Sync] Unexpected:', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
