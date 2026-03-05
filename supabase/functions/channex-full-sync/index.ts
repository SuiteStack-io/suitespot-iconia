import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSync, createAlert } from "../_shared/channex-client.ts";

/**
 * channex-full-sync
 *
 * Pushes 500 days of availability, rates, and restrictions for a single
 * property to Channex. Returns task IDs for certification.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CHANNEX_API_KEY = Deno.env.get("CHANNEX_API_KEY");
const CHANNEX_BASE_URL = Deno.env.get("CHANNEX_BASE_URL");
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 6000;
const SYNC_DAYS = 500;

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

  try {
    const { propertyId } = await req.json();
    if (!propertyId) {
      return respond(400, { success: false, error: "propertyId is required" });
    }
    if (!CHANNEX_API_KEY || !CHANNEX_BASE_URL) {
      return respond(500, { success: false, error: "Channex API not configured" });
    }

    // Get Channex property mapping
    const { data: propMapping } = await supabase
      .from("channex_mappings")
      .select("*")
      .eq("entity_type", "property")
      .eq("local_id", propertyId)
      .eq("sync_status", "synced")
      .maybeSingle();

    if (!propMapping) {
      return respond(400, { success: false, error: "Property not synced to Channex. Sync it first." });
    }

    const channexPropertyId = propMapping.channex_id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = addDays(today, SYNC_DAYS);

    const result = {
      availability_task_ids: [] as string[],
      rates_task_ids: [] as string[],
      room_types_pushed: 0,
      rate_plans_pushed: 0,
      errors: [] as string[],
    };
    const availabilityResponses: any[] = [];
    const ratesResponses: any[] = [];

    // ── AVAILABILITY ──────────────────────────────────────────
    const { data: roomTypeMappings } = await supabase
      .from("channex_mappings")
      .select("*")
      .eq("entity_type", "room_type")
      .eq("sync_status", "synced");

    // Filter to room types belonging to this property
    const propertyRoomTypeMappings: any[] = [];
    if (roomTypeMappings) {
      for (const rtm of roomTypeMappings) {
        const { data: unit } = await supabase
          .from("units")
          .select("property_id, booking_com_name")
          .eq("id", rtm.local_id)
          .maybeSingle();
        if (unit?.property_id === propertyId) {
          propertyRoomTypeMappings.push({ ...rtm, booking_com_name: unit.booking_com_name });
        }
      }
    }

    for (const rtMapping of propertyRoomTypeMappings) {
      try {
        const roomName = rtMapping.booking_com_name;
        if (!roomName) continue;

        const { data: allUnits } = await supabase
          .from("units")
          .select("id")
          .eq("booking_com_name", roomName)
          .eq("property_id", propertyId)
          .neq("status", "maintenance");

        const totalUnits = allUnits?.length || 0;
        if (totalUnits === 0) continue;

        const unitIds = allUnits!.map((u: any) => u.id);

        const { data: reservations } = await supabase
          .from("reservations")
          .select("unit_id, check_in_date, check_out_date")
          .in("status", ["confirmed", "checked-in"])
          .in("unit_id", unitIds)
          .lt("check_in_date", formatDate(endDate))
          .gt("check_out_date", formatDate(today));

        const { data: blockedDates } = await supabase
          .from("blocked_dates")
          .select("unit_id, blocked_date")
          .in("unit_id", unitIds)
          .gte("blocked_date", formatDate(today))
          .lt("blocked_date", formatDate(endDate));

        // Build day-by-day then collapse into ranges
        const availByDate: { date: string; avail: number }[] = [];
        for (let d = new Date(today); d < endDate; d = addDays(d, 1)) {
          const ds = formatDate(d);
          const occupiedUnits = new Set<string>();
          if (reservations) {
            for (const r of reservations) {
              if (r.check_in_date <= ds && r.check_out_date > ds && r.unit_id) {
                occupiedUnits.add(r.unit_id);
              }
            }
          }
          const blockedUnits = new Set<string>();
          if (blockedDates) {
            for (const b of blockedDates) {
              if (b.blocked_date === ds && b.unit_id && !occupiedUnits.has(b.unit_id)) {
                blockedUnits.add(b.unit_id);
              }
            }
          }
          availByDate.push({ date: ds, avail: Math.max(0, totalUnits - occupiedUnits.size - blockedUnits.size) });
        }

        // Collapse
        const ranges: { date_from: string; date_to: string; availability: number }[] = [];
        let rangeStart = availByDate[0];
        let currentAvail = rangeStart.avail;
        let lastDate = rangeStart.date;
        for (let i = 1; i < availByDate.length; i++) {
          if (availByDate[i].avail === currentAvail) {
            lastDate = availByDate[i].date;
          } else {
            ranges.push({ date_from: rangeStart.date, date_to: formatDate(addDays(new Date(lastDate), 1)), availability: currentAvail });
            rangeStart = availByDate[i];
            currentAvail = rangeStart.avail;
            lastDate = rangeStart.date;
          }
        }
        ranges.push({ date_from: rangeStart.date, date_to: formatDate(addDays(new Date(lastDate), 1)), availability: currentAvail });

        const availValues = ranges.map((r) => ({
          property_id: channexPropertyId,
          room_type_id: rtMapping.channex_id,
          date_from: r.date_from,
          date_to: r.date_to,
          availability: r.availability,
        }));

        // Push in batches, capture task IDs
        for (let i = 0; i < availValues.length; i += BATCH_SIZE) {
          const batch = availValues.slice(i, i + BATCH_SIZE);
          try {
            const resp = await rawChannexPost("/api/v1/availability", { values: batch });
            if (resp.taskId) result.availability_task_ids.push(resp.taskId);
            availabilityResponses.push(resp.rawData);
          } catch (err: any) {
            result.errors.push(`Avail ${roomName} batch ${Math.floor(i / BATCH_SIZE)}: ${err.message}`);
          }
          if (i + BATCH_SIZE < availValues.length) await delay(BATCH_DELAY_MS);
        }

        result.room_types_pushed++;
        console.log(`[full-sync] Pushed ${availValues.length} availability ranges for ${roomName}`);
      } catch (err: any) {
        result.errors.push(`Room type ${rtMapping.local_id}: ${err.message}`);
      }
    }

    // ── RATES + RESTRICTIONS ──────────────────────────────────
    const { data: ratePlanMappings } = await supabase
      .from("channex_mappings")
      .select("*")
      .eq("entity_type", "rate_plan")
      .eq("sync_status", "synced");

    // Filter to rate plans belonging to this property
    const propertyRatePlanMappings: any[] = [];
    if (ratePlanMappings) {
      for (const rpm of ratePlanMappings) {
        const { data: rp } = await supabase
          .from("rate_plans")
          .select("property_id")
          .eq("id", rpm.local_id)
          .maybeSingle();
        if (rp?.property_id === propertyId) {
          propertyRatePlanMappings.push(rpm);
        }
      }
    }

    for (const rpMapping of propertyRatePlanMappings) {
      try {
        const { data: ratePlan } = await supabase
          .from("rate_plans")
          .select("*")
          .eq("id", rpMapping.local_id)
          .maybeSingle();

        if (!ratePlan) continue;

        const { data: prices } = await supabase
          .from("rate_plan_prices")
          .select("*")
          .eq("rate_plan_id", rpMapping.local_id);

        if (!prices || prices.length === 0) continue;

        const { data: dateRestrictions } = await supabase
          .from("rate_plan_restrictions")
          .select("*")
          .eq("rate_plan_id", rpMapping.local_id)
          .lt("date_from", formatDate(endDate))
          .gt("date_to", formatDate(today));

        const dateFrom = ratePlan.valid_from || formatDate(today);
        const dateTo = ratePlan.valid_to || formatDate(endDate);
        const CHUNK_DAYS = 30;
        const todayStr = formatDate(today);

        const rateValues: Record<string, any>[] = [];
        for (const p of prices) {
          const rateInCents = Math.round(p.weekday_rate * 100);
          let chunkStart = new Date(dateFrom);
          const rangeEnd = new Date(dateTo);

          while (chunkStart < rangeEnd) {
            const chunkEnd = new Date(Math.min(addDays(chunkStart, CHUNK_DAYS).getTime(), rangeEnd.getTime()));
            const chunkFromStr = formatDate(chunkStart);
            const chunkToStr = formatDate(chunkEnd);

            if (chunkToStr <= todayStr) { chunkStart = chunkEnd; continue; }

            const effectiveFrom = chunkFromStr < todayStr ? todayStr : chunkFromStr;

            const chunkRestriction = dateRestrictions?.find(
              (r: any) => r.date_from <= effectiveFrom && r.date_to >= chunkToStr
            );

            const defaultMinStayArr = ratePlan.default_min_stay_arrival;
            const defaultMinStayVal = Array.isArray(defaultMinStayArr) && defaultMinStayArr.length > 0 ? defaultMinStayArr[0] : 1;
            const defaultMinThroughArr = ratePlan.default_min_stay_through;
            const defaultMinThroughVal = Array.isArray(defaultMinThroughArr) && defaultMinThroughArr.length > 0 ? defaultMinThroughArr[0] : 1;

            const value: Record<string, any> = {
              property_id: channexPropertyId,
              rate_plan_id: rpMapping.channex_id,
              date_from: effectiveFrom,
              date_to: chunkToStr,
              rate: rateInCents,
              min_stay_arrival: chunkRestriction?.min_stay_arrival ?? defaultMinStayVal,
              min_stay_through: chunkRestriction?.min_stay_through ?? defaultMinThroughVal,
              stop_sell: chunkRestriction?.stop_sell ?? ratePlan.default_stop_sell ?? false,
              closed_to_arrival: chunkRestriction?.closed_to_arrival ?? ratePlan.default_closed_to_arrival ?? false,
              closed_to_departure: chunkRestriction?.closed_to_departure ?? ratePlan.default_closed_to_departure ?? false,
            };

            const maxStay = chunkRestriction?.max_stay ?? ratePlan.default_max_stay ?? null;
            if (maxStay) value.max_stay = maxStay;

            rateValues.push(value);
            chunkStart = chunkEnd;
          }
        }

        // Push in batches, capture task IDs
        for (let i = 0; i < rateValues.length; i += BATCH_SIZE) {
          const batch = rateValues.slice(i, i + BATCH_SIZE);
          try {
            const resp = await rawChannexPost("/api/v1/restrictions", { values: batch });
            if (resp.taskId) result.rates_task_ids.push(resp.taskId);
            ratesResponses.push(resp.rawData);
          } catch (err: any) {
            result.errors.push(`Rates ${ratePlan.name} batch ${Math.floor(i / BATCH_SIZE)}: ${err.message}`);
          }
          if (i + BATCH_SIZE < rateValues.length) await delay(BATCH_DELAY_MS);
        }

        // Mark restrictions synced
        if (dateRestrictions && dateRestrictions.length > 0) {
          await supabase
            .from("rate_plan_restrictions")
            .update({ synced_to_channex: true })
            .in("id", dateRestrictions.map((r: any) => r.id));
        }

        result.rate_plans_pushed++;
        console.log(`[full-sync] Pushed ${rateValues.length} rate+restriction values for ${ratePlan.name}`);
      } catch (err: any) {
        result.errors.push(`Rate plan ${rpMapping.local_id}: ${err.message}`);
      }
    }

    // ── LOG ────────────────────────────────────────────────────
    await logSync(
      "channex-full-sync",
      "full-sync",
      {
        propertyId,
        days: SYNC_DAYS,
        room_types: propertyRoomTypeMappings.map((m: any) => ({ local_id: m.local_id, channex_id: m.channex_id, name: m.booking_com_name })),
        rate_plans: propertyRatePlanMappings.map((m: any) => ({ local_id: m.local_id, channex_id: m.channex_id })),
      },
      {
        room_types_pushed: result.room_types_pushed,
        rate_plans_pushed: result.rate_plans_pushed,
        availability_task_ids: result.availability_task_ids,
        rates_task_ids: result.rates_task_ids,
        availability_responses: availabilityResponses,
        rates_responses: ratesResponses,
      },
      200,
      result.errors.length === 0,
      result.errors.length > 0 ? result.errors.join("; ") : null,
      propertyId
    );

    if (result.errors.length > 0) {
      await createAlert("sync_error", `Full sync had ${result.errors.length} error(s): ${result.errors.slice(0, 3).join("; ")}`, propertyId);
    }

    return respond(200, { success: true, ...result, duration_seconds: elapsed(startTime) });
  } catch (err: any) {
    console.error("[full-sync] Fatal error:", err);
    try {
      await logSync("channex-full-sync", "full-sync", null, null, null, false, err.message, null);
    } catch { /* ignore */ }
    return respond(500, { success: false, error: err.message });
  }
});

// Raw POST to Channex that captures task IDs from the response
async function rawChannexPost(endpoint: string, body: object): Promise<{ taskId: string | null; rawData: any }> {
  const url = `${CHANNEX_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "user-api-key": CHANNEX_API_KEY!,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }

  const data = await response.json();
  // Channex returns task IDs in data array or data.id
  const taskId = data?.data?.[0]?.id || data?.data?.id || data?.meta?.task_id || null;
  return { taskId, rawData: data };
}

function elapsed(start: number): number {
  return Math.round((Date.now() - start) / 1000);
}

function respond(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
