import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { channexRequest, logSync } from "../_shared/channex-client.ts";

/**
 * channex-daily-sync
 *
 * Scheduled daily backup: pushes all availability and rates for the next
 * 365 days to Channex. Ensures data consistency even if real-time triggers
 * missed updates.
 *
 * Called by pg_cron – no user auth required.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 6000; // 6s between batches → max 10 req/min

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const summary = {
    properties_synced: 0,
    availability_values_pushed: 0,
    rate_values_pushed: 0,
    errors: [] as string[],
  };

  try {
    // ── 1. Get all synced properties ─────────────────────────────
    const { data: propertyMappings, error: propErr } = await supabase
      .from("channex_mappings")
      .select("*")
      .eq("entity_type", "property")
      .eq("sync_status", "synced");

    if (propErr) throw new Error(`Failed to fetch property mappings: ${propErr.message}`);
    if (!propertyMappings || propertyMappings.length === 0) {
      return respond(200, { success: true, message: "No synced properties found", summary, duration_seconds: elapsed(startTime) });
    }

    console.log(`[daily-sync] Found ${propertyMappings.length} synced properties`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = addDays(today, 365);

    // ── 2. Process each property ─────────────────────────────────
    for (const propMapping of propertyMappings) {
      try {
        console.log(`[daily-sync] Processing property ${propMapping.local_id} (Channex: ${propMapping.channex_id})`);

        // ── 2a. AVAILABILITY ──────────────────────────────────────
        const { data: roomTypeMappings } = await supabase
          .from("channex_mappings")
          .select("*")
          .eq("entity_type", "room_type")
          .eq("sync_status", "synced");

        if (roomTypeMappings && roomTypeMappings.length > 0) {
          for (const rtMapping of roomTypeMappings) {
            try {
              // Get room type name from the unit
              const { data: unitData } = await supabase
                .from("units")
                .select("booking_com_name")
                .eq("id", rtMapping.local_id)
                .maybeSingle();

              if (!unitData?.booking_com_name) {
                summary.errors.push(`Room type ${rtMapping.local_id}: no booking_com_name`);
                continue;
              }

              // Get all units of this room type (not maintenance)
              const { data: allUnits } = await supabase
                .from("units")
                .select("id")
                .eq("booking_com_name", unitData.booking_com_name)
                .neq("status", "maintenance");

              const totalUnits = allUnits?.length || 0;
              if (totalUnits === 0) continue;

              const unitIds = allUnits!.map((u: any) => u.id);

              // Get all reservations overlapping the 365-day window
              const { data: reservations } = await supabase
                .from("reservations")
                .select("unit_id, check_in_date, check_out_date")
                .in("status", ["confirmed", "checked-in"])
                .in("unit_id", unitIds)
                .lt("check_in_date", formatDate(endDate))
                .gt("check_out_date", formatDate(today));

              // Get all blocked dates in the window
              const { data: blockedDates } = await supabase
                .from("blocked_dates")
                .select("unit_id, blocked_date")
                .in("unit_id", unitIds)
                .gte("blocked_date", formatDate(today))
                .lt("blocked_date", formatDate(endDate));

              // Build day-by-day availability
              const availByDate: { date: string; avail: number }[] = [];
              for (let d = new Date(today); d < endDate; d = addDays(d, 1)) {
                const ds = formatDate(d);
                // Count reservations overlapping this date
                let reserved = 0;
                const occupiedUnits = new Set<string>();
                if (reservations) {
                  for (const r of reservations) {
                    if (r.check_in_date <= ds && r.check_out_date > ds && r.unit_id) {
                      occupiedUnits.add(r.unit_id);
                    }
                  }
                }
                reserved = occupiedUnits.size;

                // Count blocked dates on this date
                let blocked = 0;
                const blockedUnits = new Set<string>();
                if (blockedDates) {
                  for (const b of blockedDates) {
                    if (b.blocked_date === ds && b.unit_id && !occupiedUnits.has(b.unit_id)) {
                      blockedUnits.add(b.unit_id);
                    }
                  }
                }
                blocked = blockedUnits.size;

                availByDate.push({ date: ds, avail: Math.max(0, totalUnits - reserved - blocked) });
              }

              // Collapse consecutive same-availability dates into ranges
              const ranges: { date_from: string; date_to: string; availability: number }[] = [];
              let rangeStart = availByDate[0];
              let currentAvail = rangeStart.avail;
              let lastDate = rangeStart.date;

              for (let i = 1; i < availByDate.length; i++) {
                if (availByDate[i].avail === currentAvail) {
                  lastDate = availByDate[i].date;
                } else {
                  ranges.push({
                    date_from: rangeStart.date,
                    date_to: formatDate(addDays(new Date(lastDate), 1)),
                    availability: currentAvail,
                  });
                  rangeStart = availByDate[i];
                  currentAvail = rangeStart.avail;
                  lastDate = rangeStart.date;
                }
              }
              // Push last range
              ranges.push({
                date_from: rangeStart.date,
                date_to: formatDate(addDays(new Date(lastDate), 1)),
                availability: currentAvail,
              });

              // Build values array
              const availValues = ranges.map((r) => ({
                property_id: propMapping.channex_id,
                room_type_id: rtMapping.channex_id,
                date_from: r.date_from,
                date_to: r.date_to,
                availability: r.availability,
              }));

              // Push in batches of 10
              for (let i = 0; i < availValues.length; i += BATCH_SIZE) {
                const batch = availValues.slice(i, i + BATCH_SIZE);
                try {
                  await channexRequest("POST", "/api/v1/availability", { values: batch });
                  summary.availability_values_pushed += batch.length;
                } catch (err: any) {
                  summary.errors.push(`Availability push failed for ${unitData.booking_com_name} batch ${i / BATCH_SIZE}: ${err.message}`);
                }
                if (i + BATCH_SIZE < availValues.length) await delay(BATCH_DELAY_MS);
              }

              console.log(`[daily-sync] Pushed ${availValues.length} availability ranges for ${unitData.booking_com_name}`);
            } catch (err: any) {
              summary.errors.push(`Room type ${rtMapping.local_id}: ${err.message}`);
            }
          }
        }

        // ── 2b. RATES ─────────────────────────────────────────────
        const { data: ratePlanMappings } = await supabase
          .from("channex_mappings")
          .select("*")
          .eq("entity_type", "rate_plan")
          .eq("sync_status", "synced");

        if (ratePlanMappings && ratePlanMappings.length > 0) {
          for (const rpMapping of ratePlanMappings) {
            try {
              // Get rate plan details
              const { data: ratePlan } = await supabase
                .from("rate_plans")
                .select("*")
                .eq("id", rpMapping.local_id)
                .maybeSingle();

              if (!ratePlan) {
                summary.errors.push(`Rate plan ${rpMapping.local_id}: not found`);
                continue;
              }

              // Get prices for this rate plan
              const { data: prices } = await supabase
                .from("rate_plan_prices")
                .select("*")
                .eq("rate_plan_id", rpMapping.local_id);

              if (!prices || prices.length === 0) continue;

              const dateFrom = ratePlan.valid_from || formatDate(today);
              const dateTo = ratePlan.valid_to || formatDate(endDate);

              const rateValues = prices.map((p: any) => ({
                property_id: propMapping.channex_id,
                rate_plan_id: rpMapping.channex_id,
                date_from: dateFrom,
                date_to: dateTo,
                rate: Math.round(p.weekday_rate * 100),
              }));

              // Push in batches of 10
              for (let i = 0; i < rateValues.length; i += BATCH_SIZE) {
                const batch = rateValues.slice(i, i + BATCH_SIZE);
                try {
                  await channexRequest("POST", "/api/v1/restrictions", { values: batch });
                  summary.rate_values_pushed += batch.length;
                } catch (err: any) {
                  summary.errors.push(`Rate push failed for plan ${ratePlan.name} batch ${i / BATCH_SIZE}: ${err.message}`);
                }
                if (i + BATCH_SIZE < rateValues.length) await delay(BATCH_DELAY_MS);
              }

              console.log(`[daily-sync] Pushed ${rateValues.length} rate values for plan ${ratePlan.name}`);
            } catch (err: any) {
              summary.errors.push(`Rate plan ${rpMapping.local_id}: ${err.message}`);
            }
          }
        }

        summary.properties_synced++;
      } catch (err: any) {
        summary.errors.push(`Property ${propMapping.local_id}: ${err.message}`);
      }
    }

    // ── 3. Log summary ──────────────────────────────────────────
    await logSync(
      "channex-daily-sync",
      "full-sync",
      { summary },
      { summary },
      200,
      summary.errors.length === 0,
      summary.errors.length > 0 ? summary.errors.join("; ") : null,
      propertyMappings[0]?.local_id || null
    );

    return respond(200, { success: true, summary, duration_seconds: elapsed(startTime) });
  } catch (err: any) {
    console.error("[daily-sync] Fatal error:", err);
    try {
      await logSync("channex-daily-sync", "full-sync", null, null, null, false, err.message, null);
    } catch { /* ignore */ }
    return respond(500, { success: false, error: err.message, summary, duration_seconds: elapsed(startTime) });
  }
});

function elapsed(start: number): number {
  return Math.round((Date.now() - start) / 1000);
}

function respond(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
