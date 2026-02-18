/**
 * Channex Sync Property Edge Function (v3)
 * 
 * Reads property config from channex_property_config table,
 * creates ONE property in Channex, groups units by room type,
 * and creates rate plans for each room type with rate pushes.
 * 
 * POST /channex-sync-property
 * Body: { "mode": "full" | "rate_plans_only" } (optional, defaults to "full")
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
  entity: 'property' | 'room_type' | 'rate_plan' | 'rate_push';
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

interface PropertySyncProps {
  onSwitchToSettings?: () => void;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    // =========================================================================
    // AUTH
    // =========================================================================
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

    // =========================================================================
    // PARSE MODE
    // =========================================================================
    let mode = 'full';
    try {
      const body = await req.json();
      if (body.mode) mode = body.mode;
    } catch { /* no body = full mode */ }

    // =========================================================================
    // STEP 0: READ PROPERTY CONFIG
    // =========================================================================
    const { data: propertyConfig, error: configError } = await supabaseAdmin
      .from('channex_property_config')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (configError || !propertyConfig) {
      return new Response(JSON.stringify({ error: 'Please configure property settings first.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[Sync] Starting sync (mode: ${mode}) for: ${propertyConfig.property_name}`);

    const errors: SyncError[] = [];
    const roomTypeResults: { local_id: string; channex_id: string; name: string; status: string }[] = [];
    const ratePlanResults: { local_id: string; channex_id: string; name: string; room_type: string; status: string }[] = [];
    let channexPropertyId: string;
    let propertyStatus = 'skipped';

    // =========================================================================
    // STEP 1: PROPERTY SYNC (skip if rate_plans_only)
    // =========================================================================
    if (mode === 'full') {
      const { data: existingPropertyMapping } = await supabaseAdmin
        .from('channex_mappings')
        .select('channex_id')
        .eq('local_id', propertyConfig.id)
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
            title: propertyConfig.property_name,
            currency: propertyConfig.currency || 'USD',
            email: propertyConfig.email,
            phone: propertyConfig.phone,
            zip_code: propertyConfig.zip_code,
            country: propertyConfig.country || 'EG',
            state: propertyConfig.city || 'Cairo',
            city: propertyConfig.city || 'Cairo',
            address: propertyConfig.address || '',
            timezone: propertyConfig.timezone || 'Africa/Cairo',
            facilities: [],
            latitude: propertyConfig.latitude || 30.0626,
            longitude: propertyConfig.longitude || 31.2247,
          }
        };

        try {
          const res = await channexRequest<{ data: { id: string } }>('POST', '/api/v1/properties', payload);
          channexPropertyId = res.data.id;
          console.log(`[Property] Created -> ${channexPropertyId}`);

          await supabaseAdmin.from('channex_mappings').insert({
            local_id: propertyConfig.id,
            channex_id: channexPropertyId,
            entity_type: 'property',
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
            channex_data: res.data,
          });

          await supabaseAdmin.from('channex_property_config').update({ channex_property_id: channexPropertyId }).eq('id', propertyConfig.id);
          propertyStatus = 'created';
          await logSync('channex-sync-property', '/api/v1/properties', payload, res, 200, true, null, propertyConfig.id);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error('[Property] Failed:', msg);
          await logSync('channex-sync-property', '/api/v1/properties', payload, null, 500, false, msg, propertyConfig.id);
          await createAlert('sync_error', `Failed to create property: ${msg}`, propertyConfig.id);
          return new Response(JSON.stringify({ error: `Failed to create property: ${msg}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    } else {
      // rate_plans_only mode: resolve existing property
      const { data: existingPropertyMapping } = await supabaseAdmin
        .from('channex_mappings')
        .select('channex_id')
        .eq('local_id', propertyConfig.id)
        .eq('entity_type', 'property')
        .maybeSingle();

      if (!existingPropertyMapping) {
        return new Response(JSON.stringify({ error: 'Property must be synced first. Run a full sync.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      channexPropertyId = existingPropertyMapping.channex_id;
    }

    // =========================================================================
    // STEP 2: ROOM TYPES (skip if rate_plans_only)
    // =========================================================================
    const { data: units, error: unitsError } = await supabaseAdmin
      .from('units')
      .select('id, name, booking_com_name, max_guests, max_children, max_infants, default_occupancy, room_kind')
      .eq('location', 'ICONIA')
      .or('is_private.eq.false,is_private.is.null');

    if (unitsError) {
      errors.push({ entity: 'room_type', local_id: 'all', name: 'All', error: unitsError.message });
    }

    // Build room type groups (needed for both modes)
    const groups: Record<string, RoomTypeGroup> = {};
    if (units) {
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
    }

    if (mode === 'full' && units && units.length > 0) {
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
          await logSync('channex-sync-property', '/api/v1/room_types', payload, res, 200, true, null, propertyConfig.id);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          errors.push({ entity: 'room_type', local_id: rt.unitId, name: displayName, error: msg });
        }
      }
    }

    // =========================================================================
    // STEP 3: RATE PLANS (one per room type per PMS rate plan)
    // =========================================================================

    // Build lookup: room type display name -> channex room type ID
    // Use existing mappings from DB (works for both full and rate_plans_only modes)
    const { data: allRtMappings } = await supabaseAdmin
      .from('channex_mappings')
      .select('local_id, channex_id')
      .eq('entity_type', 'room_type')
      .eq('sync_status', 'synced');

    const rtNameToChannex: Record<string, string> = {};
    if (allRtMappings && units) {
      for (const mapping of allRtMappings) {
        const unit = units.find(u => u.id === mapping.local_id);
        if (unit) {
          const name = unit.booking_com_name || unit.name;
          rtNameToChannex[name] = mapping.channex_id;
        }
      }
    }

    console.log(`[RatePlans] Room type lookup: ${Object.keys(rtNameToChannex).length} entries`);

    // Fetch active rate plans
    const { data: ratePlans } = await supabaseAdmin
      .from('rate_plans')
      .select('id, name, currency, sell_mode, applicable_room_types, is_active')
      .eq('is_active', true);

    if (ratePlans && ratePlans.length > 0) {
      for (const rp of ratePlans) {
        // Fetch all base prices (unit_id IS NULL) for this rate plan
        const { data: priceRows } = await supabaseAdmin
          .from('rate_plan_prices')
          .select('id, room_type, weekday_rate, weekend_rate, min_stay, base_occupancy')
          .eq('rate_plan_id', rp.id)
          .is('unit_id', null);

        if (!priceRows || priceRows.length === 0) {
          console.log(`[RatePlans] No base prices for "${rp.name}", skipping`);
          continue;
        }

        console.log(`[RatePlans] Processing "${rp.name}" with ${priceRows.length} room type prices`);

        for (const priceRow of priceRows) {
          const roomTypeName = priceRow.room_type;
          const channexRtId = rtNameToChannex[roomTypeName];

          if (!channexRtId) {
            console.log(`[RatePlans] Room type "${roomTypeName}" not synced to Channex, skipping`);
            continue;
          }

          // Check if mapping already exists for this price row
          const { data: existingMapping } = await supabaseAdmin
            .from('channex_mappings')
            .select('channex_id')
            .eq('local_id', priceRow.id)
            .eq('entity_type', 'rate_plan')
            .maybeSingle();

          if (existingMapping) {
            ratePlanResults.push({
              local_id: priceRow.id,
              channex_id: existingMapping.channex_id,
              name: rp.name,
              room_type: roomTypeName,
              status: 'already_synced',
            });
            continue;
          }

          // Create rate plan in Channex
          try {
            const rpPayload = {
              rate_plan: {
                title: rp.name,
                property_id: channexPropertyId,
                room_type_id: channexRtId,
                currency: rp.currency || 'USD',
                sell_mode: rp.sell_mode || 'per_room',
                rate_mode: 'manual',
                options: [{ occupancy: priceRow.base_occupancy || 2, is_primary: true, rate: 0 }],
              }
            };

            const res = await channexRequest<{ data: { id: string } }>('POST', '/api/v1/rate_plans', rpPayload);
            const channexRpId = res.data.id;
            console.log(`[RatePlans] Created: "${rp.name}" for ${roomTypeName} -> ${channexRpId}`);

            // Save mapping with price row ID as local_id
            await supabaseAdmin.from('channex_mappings').insert({
              local_id: priceRow.id,
              channex_id: channexRpId,
              entity_type: 'rate_plan',
              sync_status: 'synced',
              last_synced_at: new Date().toISOString(),
              channex_data: {
                rate_plan_id: rp.id,
                rate_plan_name: rp.name,
                room_type: roomTypeName,
              },
            });

            ratePlanResults.push({
              local_id: priceRow.id,
              channex_id: channexRpId,
              name: rp.name,
              room_type: roomTypeName,
              status: 'created',
            });

            await logSync('channex-sync-property', '/api/v1/rate_plans', rpPayload, res, 200, true, null, propertyConfig.id);

            // =================================================================
            // PUSH INITIAL RATES for next 365 days
            // =================================================================
            try {
              const today = new Date();
              const dateFrom = today.toISOString().split('T')[0];
              const futureDate = new Date(today);
              futureDate.setDate(futureDate.getDate() + 365);
              const dateTo = futureDate.toISOString().split('T')[0];

              const weekdayRateCents = Math.round(priceRow.weekday_rate * 100);
              const weekendRateCents = Math.round(priceRow.weekend_rate * 100);

              const restrictionValues: object[] = [
                {
                  property_id: channexPropertyId,
                  rate_plan_id: channexRpId,
                  date_from: dateFrom,
                  date_to: dateTo,
                  days: { mon: true, tue: true, wed: true, thu: true },
                  rate: weekdayRateCents,
                  min_stay_arrival: priceRow.min_stay || 1,
                },
                {
                  property_id: channexPropertyId,
                  rate_plan_id: channexRpId,
                  date_from: dateFrom,
                  date_to: dateTo,
                  days: { fri: true, sat: true, sun: true },
                  rate: weekendRateCents,
                  min_stay_arrival: priceRow.min_stay || 1,
                },
              ];

              const restrictionPayload = { values: restrictionValues };
              await channexRequest<object>('POST', '/api/v1/restrictions', restrictionPayload);
              console.log(`[RatePush] Pushed rates for "${rp.name}" / ${roomTypeName}: $${priceRow.weekday_rate}/$${priceRow.weekend_rate}`);
              await logSync('channex-sync-property', '/api/v1/restrictions', restrictionPayload, null, 200, true, null, propertyConfig.id);
            } catch (pushError) {
              const pushMsg = pushError instanceof Error ? pushError.message : String(pushError);
              console.error(`[RatePush] Failed for ${roomTypeName}:`, pushMsg);
              errors.push({ entity: 'rate_push', local_id: priceRow.id, name: `${rp.name} / ${roomTypeName}`, error: pushMsg });
            }

          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            errors.push({ entity: 'rate_plan', local_id: priceRow.id, name: `${rp.name} / ${roomTypeName}`, error: msg });
          }
        }
      }
    }

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log(`[Sync] Done. RT: ${roomTypeResults.length}, RP: ${ratePlanResults.length}, Errors: ${errors.length}`);

    return new Response(JSON.stringify({
      success: true,
      mode,
      property: { local_id: propertyConfig.id, channex_id: channexPropertyId, status: propertyStatus },
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
