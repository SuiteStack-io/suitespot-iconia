import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { channexRequest, logSync } from "../_shared/channex-client.ts";

/**
 * channex-process-sync-queue
 *
 * Called by pg_net from database triggers. Reads all pending items from
 * channex_sync_queue, batches them by type (availability / rate), resolves
 * Channex IDs, pushes to the Channex API, and marks rows completed/failed.
 *
 * No user auth – called with service role key from triggers.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // ── 1. Claim pending rows ──────────────────────────────────
    const { data: pending, error: fetchErr } = await supabase
      .from("channex_sync_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchErr) throw new Error(`Failed to fetch queue: ${fetchErr.message}`);
    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Mark them processing
    const ids = pending.map((r: any) => r.id);
    await supabase
      .from("channex_sync_queue")
      .update({ status: "processing" })
      .in("id", ids);

    console.log(`[process-sync-queue] Processing ${pending.length} items`);

    // ── 2. Split by type ───────────────────────────────────────
    const availabilityItems = pending.filter((r: any) => r.sync_type === "availability");
    const rateItems = pending.filter((r: any) => r.sync_type === "rate");

    // ── Helper: resolve Channex ID ─────────────────────────────
    const mappingCache: Record<string, string | null> = {};
    async function resolve(localId: string, entityType: string): Promise<string | null> {
      const key = `${entityType}:${localId}`;
      if (key in mappingCache) return mappingCache[key];
      const { data } = await supabase
        .from("channex_mappings")
        .select("channex_id")
        .eq("local_id", localId)
        .eq("entity_type", entityType)
        .maybeSingle();
      mappingCache[key] = data?.channex_id || null;
      return mappingCache[key];
    }

    // ── 3. Process AVAILABILITY items ──────────────────────────
    if (availabilityItems.length > 0) {
      // Deduplicate by entity_id + date range
      const seen = new Set<string>();
      const deduped: any[] = [];
      for (const item of availabilityItems) {
        const key = `${item.entity_id}:${item.date_from}:${item.date_to}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(item);
        }
      }

      const values: object[] = [];

      for (const item of deduped) {
        try {
          const channexRoomTypeId = await resolve(item.entity_id, "room_type");
          if (!channexRoomTypeId) {
            await markFailed(supabase, item.id, "Room type not mapped to Channex");
            continue;
          }

          // Look up the room type name from the unit
          const { data: unitData } = await supabase
            .from("units")
            .select("booking_com_name, location")
            .eq("id", item.entity_id)
            .maybeSingle();

          if (!unitData?.booking_com_name) {
            await markFailed(supabase, item.id, "Unit has no booking_com_name");
            continue;
          }

          // Find property mapping via location
          const { data: propUnit } = await supabase
            .from("channex_mappings")
            .select("channex_id, local_id")
            .eq("entity_type", "property")
            .maybeSingle();

          if (!propUnit) {
            await markFailed(supabase, item.id, "No property mapped to Channex");
            continue;
          }

          // Calculate actual availability for the date range
          const availability = await calculateAvailability(
            supabase,
            unitData.booking_com_name,
            item.date_from,
            item.date_to
          );

          values.push({
            property_id: propUnit.channex_id,
            room_type_id: channexRoomTypeId,
            date_from: item.date_from,
            date_to: item.date_to,
            availability,
          });

          await markCompleted(supabase, item.id);
        } catch (err: any) {
          await markFailed(supabase, item.id, err.message);
        }
      }

      // Mark deduplicated-out items as completed too
      const dedupedIds = new Set(deduped.map((d: any) => d.id));
      for (const item of availabilityItems) {
        if (!dedupedIds.has(item.id)) {
          await markCompleted(supabase, item.id);
        }
      }

      if (values.length > 0) {
        try {
          const channexPayload = { values };
          console.log(`[process-sync-queue] Pushing ${values.length} availability values`);
          const response = await channexRequest<object>("POST", "/api/v1/availability", channexPayload);
          await logSync("channex-process-sync-queue", "/api/v1/availability", channexPayload, response, 200, true, null, null);
        } catch (err: any) {
          console.error("[process-sync-queue] Availability push failed:", err.message);
          await logSync("channex-process-sync-queue", "/api/v1/availability", null, null, null, false, err.message, null);
        }
      }
    }

    // ── 4. Process RATE items ───────────────────────────────────
    if (rateItems.length > 0) {
      const values: object[] = [];

      for (const item of rateItems) {
        try {
          const channexRatePlanId = await resolve(item.entity_id, "rate_plan");
          if (!channexRatePlanId) {
            await markFailed(supabase, item.id, "Rate plan not mapped to Channex");
            continue;
          }

          // Get property mapping
          const { data: propMapping } = await supabase
            .from("channex_mappings")
            .select("channex_id")
            .eq("entity_type", "property")
            .maybeSingle();

          if (!propMapping) {
            await markFailed(supabase, item.id, "No property mapped to Channex");
            continue;
          }

          const payload = item.payload || {};
          const weekdayRate = payload.weekday_rate;

          if (weekdayRate && weekdayRate > 0) {
            // Get the rate plan's valid_from/valid_to for date range
            const { data: ratePlan } = await supabase
              .from("rate_plans")
              .select("valid_from, valid_to")
              .eq("id", item.entity_id)
              .maybeSingle();

            const today = new Date().toISOString().split("T")[0];
            const dateFrom = ratePlan?.valid_from || today;
            const dateTo = ratePlan?.valid_to || new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0];

            values.push({
              property_id: propMapping.channex_id,
              rate_plan_id: channexRatePlanId,
              date_from: dateFrom,
              date_to: dateTo,
              rate: Math.round(weekdayRate * 100), // Convert to cents
            });
          }

          await markCompleted(supabase, item.id);
        } catch (err: any) {
          await markFailed(supabase, item.id, err.message);
        }
      }

      if (values.length > 0) {
        try {
          const channexPayload = { values };
          console.log(`[process-sync-queue] Pushing ${values.length} rate values`);
          const response = await channexRequest<object>("POST", "/api/v1/restrictions", channexPayload);
          await logSync("channex-process-sync-queue", "/api/v1/restrictions", channexPayload, response, 200, true, null, null);
        } catch (err: any) {
          console.error("[process-sync-queue] Rate push failed:", err.message);
          await logSync("channex-process-sync-queue", "/api/v1/restrictions", null, null, null, false, err.message, null);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: pending.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err: any) {
    console.error("[process-sync-queue] Fatal error:", err);
    try {
      await logSync("channex-process-sync-queue", "process-queue", null, null, null, false, err.message, null);
    } catch { /* ignore */ }
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

// ── Helpers ──────────────────────────────────────────────────────

async function calculateAvailability(
  supabase: any,
  roomTypeName: string,
  dateFrom: string,
  dateTo: string
): Promise<number> {
  // Count total units of this room type
  const { count: totalUnits } = await supabase
    .from("units")
    .select("id", { count: "exact", head: true })
    .eq("booking_com_name", roomTypeName)
    .neq("status", "maintenance");

  // Count reservations that overlap this date range
  const { count: reservedCount } = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .in("status", ["confirmed", "checked-in"])
    .lt("check_in_date", dateTo)
    .gt("check_out_date", dateFrom)
    .not("unit_id", "is", null)
    .in(
      "unit_id",
      supabase
        .from("units")
        .select("id")
        .eq("booking_com_name", roomTypeName)
    );

  // Count blocked dates in range
  const { count: blockedCount } = await supabase
    .from("blocked_dates")
    .select("id", { count: "exact", head: true })
    .gte("blocked_date", dateFrom)
    .lt("blocked_date", dateTo)
    .in(
      "unit_id",
      supabase
        .from("units")
        .select("id")
        .eq("booking_com_name", roomTypeName)
    );

  const available = Math.max(0, (totalUnits || 0) - (reservedCount || 0) - (blockedCount || 0));
  console.log(`[process-sync-queue] Availability for ${roomTypeName} (${dateFrom}-${dateTo}): ${available}/${totalUnits}`);
  return available;
}

async function markCompleted(supabase: any, id: string) {
  await supabase
    .from("channex_sync_queue")
    .update({ status: "completed", processed_at: new Date().toISOString() })
    .eq("id", id);
}

async function markFailed(supabase: any, id: string, error: string) {
  await supabase
    .from("channex_sync_queue")
    .update({ status: "failed", error_message: error, processed_at: new Date().toISOString() })
    .eq("id", id);
}
