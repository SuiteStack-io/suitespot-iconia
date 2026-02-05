/**
 * Channex Sync Property Edge Function
 * 
 * Performs a complete sync of a property and all its room types and rate plans
 * to Channex in a single operation. Continues processing even if individual items fail.
 * 
 * POST /channex-sync-property
 * Body: { property_id: "local-property-uuid" }
 * 
 * Returns summary with property, room_types, rate_plans, and errors arrays.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { channexRequest, logSync } from "../_shared/channex-client.ts";

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Supabase configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Default property values for Channex
const PROPERTY_DEFAULTS = {
  email: 'youssef@suitespotegypt.com',
  phone: '+201288444086',
  zip_code: '11211',
  currency: 'EGP',
  timezone: 'Africa/Cairo',
  country: 'EG',
};

// Types for results
interface PropertyResult {
  local_id: string;
  channex_id: string;
  status: 'created' | 'already_synced';
}

interface RoomTypeResult {
  local_id: string;
  channex_id: string;
  name: string;
  status: 'created' | 'already_synced';
}

interface RatePlanResult {
  local_id: string;
  channex_id: string;
  name: string;
  status: 'created' | 'already_synced';
}

interface SyncError {
  entity: 'property' | 'room_type' | 'rate_plan';
  local_id: string;
  name: string;
  error: string;
}

interface RoomTypeGroup {
  unitId: string;
  displayName: string;
  max_guests: number | null;
  max_children: number | null;
  max_infants: number | null;
  default_occupancy: number | null;
  room_kind: string | null;
  count_of_rooms: number | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // =========================================================================
    // AUTHENTICATION
    // =========================================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[Auth] Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('[Auth] Invalid token:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Auth] Authenticated user: ${user.id}`);

    // Create admin client for database operations
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify admin role
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !userRole) {
      console.error('[Auth] Admin check failed:', roleError?.message || 'Not an admin');
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Auth] Admin role verified');

    // =========================================================================
    // INPUT VALIDATION
    // =========================================================================
    const body = await req.json();
    const { property_id } = body;

    if (!property_id) {
      return new Response(
        JSON.stringify({ error: 'property_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Sync] Starting full property sync for: ${property_id}`);

    // Initialize result collectors
    const errors: SyncError[] = [];
    const roomTypeResults: RoomTypeResult[] = [];
    const ratePlanResults: RatePlanResult[] = [];
    let propertyResult: PropertyResult;
    let channexPropertyId: string;

    // =========================================================================
    // STEP 1: PROPERTY SYNC
    // =========================================================================
    console.log('[Property] Checking existing mapping...');

    const { data: existingPropertyMapping } = await supabaseAdmin
      .from('channex_mappings')
      .select('channex_id')
      .eq('local_id', property_id)
      .eq('entity_type', 'property')
      .maybeSingle();

    if (existingPropertyMapping) {
      // Property already synced
      channexPropertyId = existingPropertyMapping.channex_id;
      propertyResult = {
        local_id: property_id,
        channex_id: channexPropertyId,
        status: 'already_synced'
      };
      console.log(`[Property] Already synced -> ${channexPropertyId}`);
    } else {
      // Need to create property in Channex
      console.log('[Property] Creating new property in Channex...');

      // Fetch property details from units table (using first unit as reference)
      const { data: propertyUnit, error: unitError } = await supabaseAdmin
        .from('units')
        .select('name, address, latitude, longitude, location')
        .eq('id', property_id)
        .maybeSingle();

      if (unitError || !propertyUnit) {
        console.error('[Property] Failed to fetch property details:', unitError?.message);
        return new Response(
          JSON.stringify({ error: 'Property not found in database' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Build Channex property payload
      const channexPropertyPayload = {
        property: {
          title: propertyUnit.name || 'Iconia Zamalek',
          currency: PROPERTY_DEFAULTS.currency,
          email: PROPERTY_DEFAULTS.email,
          phone: PROPERTY_DEFAULTS.phone,
          zip_code: PROPERTY_DEFAULTS.zip_code,
          country: PROPERTY_DEFAULTS.country,
          state: 'Cairo',
          city: 'Cairo',
          address: propertyUnit.address || 'Zamalek, Cairo',
          timezone: PROPERTY_DEFAULTS.timezone,
          facilities: [],
          latitude: propertyUnit.latitude || 30.0626,
          longitude: propertyUnit.longitude || 31.2247,
        }
      };

      try {
        const channexResponse = await channexRequest<{ data: { id: string } }>(
          'POST',
          '/api/v1/properties',
          channexPropertyPayload
        );

        channexPropertyId = channexResponse.data.id;
        console.log(`[Property] Created in Channex -> ${channexPropertyId}`);

        // Save mapping
        await supabaseAdmin
          .from('channex_mappings')
          .insert({
            local_id: property_id,
            channex_id: channexPropertyId,
            entity_type: 'property',
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
            channex_data: channexResponse.data,
          });

        propertyResult = {
          local_id: property_id,
          channex_id: channexPropertyId,
          status: 'created'
        };

        await logSync('channex-sync-property', '/api/v1/properties', channexPropertyPayload, channexResponse, 200, true, null, property_id);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[Property] Failed to create in Channex:', errorMessage);
        await logSync('channex-sync-property', '/api/v1/properties', channexPropertyPayload, null, 500, false, errorMessage, property_id);
        return new Response(
          JSON.stringify({ error: `Failed to create property: ${errorMessage}` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // =========================================================================
    // STEP 2: ROOM TYPES SYNC
    // =========================================================================
    console.log('[RoomTypes] Fetching units for property...');

    // Get all units for this property location (non-private)
    const { data: units, error: unitsError } = await supabaseAdmin
      .from('units')
      .select('id, name, booking_com_name, max_guests, max_children, max_infants, default_occupancy, room_kind, count_of_rooms, location')
      .eq('location', 'ICONIA')
      .or('is_private.eq.false,is_private.is.null');

    if (unitsError) {
      console.error('[RoomTypes] Failed to fetch units:', unitsError.message);
      errors.push({
        entity: 'room_type',
        local_id: 'all',
        name: 'All Room Types',
        error: `Failed to fetch units: ${unitsError.message}`
      });
    } else if (units && units.length > 0) {
      // Group units by display name
      const roomTypeGroups: Record<string, RoomTypeGroup> = {};
      
      for (const unit of units) {
        const displayName = unit.booking_com_name || unit.name;
        if (!roomTypeGroups[displayName]) {
          roomTypeGroups[displayName] = {
            unitId: unit.id,
            displayName,
            max_guests: unit.max_guests,
            max_children: unit.max_children,
            max_infants: unit.max_infants,
            default_occupancy: unit.default_occupancy,
            room_kind: unit.room_kind,
            count_of_rooms: unit.count_of_rooms,
          };
        }
      }

      console.log(`[RoomTypes] Found ${Object.keys(roomTypeGroups).length} unique room types to sync`);

      // Process each room type
      for (const [displayName, roomType] of Object.entries(roomTypeGroups)) {
        console.log(`[RoomTypes] Processing: ${displayName}`);

        try {
          // Check if already synced (by unit ID)
          const { data: existingRoomTypeMapping } = await supabaseAdmin
            .from('channex_mappings')
            .select('channex_id')
            .eq('local_id', roomType.unitId)
            .eq('entity_type', 'room_type')
            .maybeSingle();

          if (existingRoomTypeMapping) {
            console.log(`[RoomTypes] Already synced: ${displayName} -> ${existingRoomTypeMapping.channex_id}`);
            roomTypeResults.push({
              local_id: roomType.unitId,
              channex_id: existingRoomTypeMapping.channex_id,
              name: displayName,
              status: 'already_synced'
            });
            continue;
          }

          // Create room type in Channex
          const channexRoomTypePayload = {
            room_type: {
              title: displayName,
              property_id: channexPropertyId,
              count_of_rooms: roomType.count_of_rooms || 1,
              occ_adults: roomType.max_guests || 2,
              occ_children: roomType.max_children || 0,
              occ_infants: roomType.max_infants || 0,
              default_occupancy: roomType.default_occupancy || 2,
              kind: roomType.room_kind || 'room',
            }
          };

          const channexResponse = await channexRequest<{ data: { id: string } }>(
            'POST',
            '/api/v1/room_types',
            channexRoomTypePayload
          );

          const channexRoomTypeId = channexResponse.data.id;
          console.log(`[RoomTypes] Created: ${displayName} -> ${channexRoomTypeId}`);

          // Save mapping
          await supabaseAdmin
            .from('channex_mappings')
            .insert({
              local_id: roomType.unitId,
              channex_id: channexRoomTypeId,
              entity_type: 'room_type',
              sync_status: 'synced',
              last_synced_at: new Date().toISOString(),
              channex_data: channexResponse.data,
            });

          roomTypeResults.push({
            local_id: roomType.unitId,
            channex_id: channexRoomTypeId,
            name: displayName,
            status: 'created'
          });

          await logSync('channex-sync-property', '/api/v1/room_types', channexRoomTypePayload, channexResponse, 200, true, null, property_id);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[RoomTypes] Failed to sync ${displayName}:`, errorMessage);
          errors.push({
            entity: 'room_type',
            local_id: roomType.unitId,
            name: displayName,
            error: errorMessage
          });
        }
      }
    } else {
      console.log('[RoomTypes] No units found for property');
    }

    // =========================================================================
    // STEP 3: RATE PLANS SYNC
    // =========================================================================
    console.log('[RatePlans] Fetching rate plans...');

    const { data: ratePlans, error: ratePlansError } = await supabaseAdmin
      .from('rate_plans')
      .select('id, name, currency, sell_mode, applicable_room_types, is_active');

    if (ratePlansError) {
      console.error('[RatePlans] Failed to fetch rate plans:', ratePlansError.message);
      errors.push({
        entity: 'rate_plan',
        local_id: 'all',
        name: 'All Rate Plans',
        error: `Failed to fetch rate plans: ${ratePlansError.message}`
      });
    } else if (ratePlans && ratePlans.length > 0) {
      console.log(`[RatePlans] Found ${ratePlans.length} rate plans to sync`);

      // Build a lookup map for room type names to Channex IDs
      const roomTypeMappings: Record<string, { channexId: string; localId: string }> = {};
      
      // Get all room type mappings we just created or found
      for (const result of roomTypeResults) {
        // We need to find the display name for this local_id
        const unit = units?.find(u => u.id === result.local_id);
        if (unit) {
          const displayName = unit.booking_com_name || unit.name;
          roomTypeMappings[displayName] = {
            channexId: result.channex_id,
            localId: result.local_id
          };
        }
      }

      // Process each rate plan
      for (const ratePlan of ratePlans) {
        console.log(`[RatePlans] Processing: ${ratePlan.name}`);

        try {
          // Check if already synced
          const { data: existingRatePlanMapping } = await supabaseAdmin
            .from('channex_mappings')
            .select('channex_id')
            .eq('local_id', ratePlan.id)
            .eq('entity_type', 'rate_plan')
            .maybeSingle();

          if (existingRatePlanMapping) {
            console.log(`[RatePlans] Already synced: ${ratePlan.name} -> ${existingRatePlanMapping.channex_id}`);
            ratePlanResults.push({
              local_id: ratePlan.id,
              channex_id: existingRatePlanMapping.channex_id,
              name: ratePlan.name,
              status: 'already_synced'
            });
            continue;
          }

          // Find a room type with Channex mapping from applicable_room_types
          let channexRoomTypeId: string | null = null;
          let matchedRoomType: string | null = null;
          let matchedLocalId: string | null = null;

          const applicableRoomTypes = ratePlan.applicable_room_types || [];
          
          for (const roomTypeName of applicableRoomTypes) {
            const mapping = roomTypeMappings[roomTypeName];
            if (mapping) {
              channexRoomTypeId = mapping.channexId;
              matchedRoomType = roomTypeName;
              matchedLocalId = mapping.localId;
              break;
            }
          }

          // If no match found in applicable_room_types, use the first available room type
          if (!channexRoomTypeId && roomTypeResults.length > 0) {
            const firstRoomType = roomTypeResults[0];
            channexRoomTypeId = firstRoomType.channex_id;
            matchedRoomType = firstRoomType.name;
            matchedLocalId = firstRoomType.local_id;
            console.log(`[RatePlans] No applicable room type found, using first available: ${matchedRoomType}`);
          }

          if (!channexRoomTypeId) {
            console.error(`[RatePlans] No synced room type found for: ${ratePlan.name}`);
            errors.push({
              entity: 'rate_plan',
              local_id: ratePlan.id,
              name: ratePlan.name,
              error: 'No synced room type found'
            });
            continue;
          }

          console.log(`[RatePlans] Matched room type: ${matchedRoomType} -> ${channexRoomTypeId}`);

          // Get occupancy from rate_plan_prices
          const { data: ratePrice } = await supabaseAdmin
            .from('rate_plan_prices')
            .select('base_occupancy')
            .eq('rate_plan_id', ratePlan.id)
            .maybeSingle();

          const baseOccupancy = ratePrice?.base_occupancy || 2;

          // Create rate plan in Channex
          const channexRatePlanPayload = {
            rate_plan: {
              title: ratePlan.name,
              property_id: channexPropertyId,
              room_type_id: channexRoomTypeId,
              currency: ratePlan.currency || 'EGP',
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

          const channexResponse = await channexRequest<{ data: { id: string } }>(
            'POST',
            '/api/v1/rate_plans',
            channexRatePlanPayload
          );

          const channexRatePlanId = channexResponse.data.id;
          console.log(`[RatePlans] Created: ${ratePlan.name} -> ${channexRatePlanId}`);

          // Save mapping
          await supabaseAdmin
            .from('channex_mappings')
            .insert({
              local_id: ratePlan.id,
              channex_id: channexRatePlanId,
              entity_type: 'rate_plan',
              sync_status: 'synced',
              last_synced_at: new Date().toISOString(),
              channex_data: channexResponse.data,
            });

          ratePlanResults.push({
            local_id: ratePlan.id,
            channex_id: channexRatePlanId,
            name: ratePlan.name,
            status: 'created'
          });

          await logSync('channex-sync-property', '/api/v1/rate_plans', channexRatePlanPayload, channexResponse, 200, true, null, property_id);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[RatePlans] Failed to sync ${ratePlan.name}:`, errorMessage);
          errors.push({
            entity: 'rate_plan',
            local_id: ratePlan.id,
            name: ratePlan.name,
            error: errorMessage
          });
        }
      }
    } else {
      console.log('[RatePlans] No rate plans found');
    }

    // =========================================================================
    // FINAL SUMMARY
    // =========================================================================
    const createdRoomTypes = roomTypeResults.filter(r => r.status === 'created').length;
    const skippedRoomTypes = roomTypeResults.filter(r => r.status === 'already_synced').length;
    const createdRatePlans = ratePlanResults.filter(r => r.status === 'created').length;
    const skippedRatePlans = ratePlanResults.filter(r => r.status === 'already_synced').length;

    console.log(`[Sync] Complete. Property: ${propertyResult.status}, Room Types: ${createdRoomTypes} created / ${skippedRoomTypes} skipped, Rate Plans: ${createdRatePlans} created / ${skippedRatePlans} skipped, Errors: ${errors.length}`);

    // Log overall sync operation
    await logSync(
      'channex-sync-property',
      '/sync',
      { property_id },
      { property: propertyResult, room_types: roomTypeResults.length, rate_plans: ratePlanResults.length, errors: errors.length },
      200,
      errors.length === 0,
      errors.length > 0 ? `${errors.length} errors occurred` : null,
      property_id
    );

    return new Response(
      JSON.stringify({
        success: true,
        property: propertyResult,
        room_types: roomTypeResults,
        rate_plans: ratePlanResults,
        errors
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Sync] Unexpected error:', errorMessage);
    return new Response(
      JSON.stringify({ error: `Unexpected error: ${errorMessage}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
