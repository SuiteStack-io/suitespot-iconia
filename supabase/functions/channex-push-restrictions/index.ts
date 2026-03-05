import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { subDays, format } from "https://esm.sh/date-fns@3.6.0";
import { channexRequest, logSync } from "../_shared/channex-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 6000;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const summary = {
    restrictions_pushed: 0,
    errors: [] as string[],
  };
  const allResponses: any[] = [];

  try {
    const body = await req.json().catch(() => ({}));
    const ratePlanIds: string[] | undefined = body.rate_plan_ids;

    // Get unsynced restrictions
    let query = supabase
      .from("rate_plan_restrictions")
      .select("*")
      .eq("synced_to_channex", false);

    if (ratePlanIds && ratePlanIds.length > 0) {
      query = query.in("rate_plan_id", ratePlanIds);
    }

    const { data: restrictions, error: fetchErr } = await query;
    if (fetchErr) throw new Error(`Failed to fetch restrictions: ${fetchErr.message}`);

    if (!restrictions || restrictions.length === 0) {
      return respond(200, { success: true, message: "No unsynced restrictions", summary });
    }

    console.log(`[push-restrictions] Found ${restrictions.length} unsynced restrictions`);

    // Get property mapping
    const { data: propMapping } = await supabase
      .from("channex_mappings")
      .select("channex_id, local_id")
      .eq("entity_type", "property")
      .eq("sync_status", "synced")
      .limit(1)
      .maybeSingle();

    if (!propMapping) {
      throw new Error("No synced property found in channex_mappings");
    }

    // Get all rate plan mappings
    const { data: rpMappings } = await supabase
      .from("channex_mappings")
      .select("local_id, channex_id")
      .eq("entity_type", "rate_plan")
      .eq("sync_status", "synced");

    const rpMap = new Map((rpMappings || []).map((m: any) => [m.local_id, m.channex_id]));

    // Build values
    const values: object[] = [];
    for (const r of restrictions) {
      const channexRpId = rpMap.get(r.rate_plan_id);
      if (!channexRpId) {
        summary.errors.push(`Rate plan ${r.rate_plan_id}: no Channex mapping`);
        continue;
      }

      const inclusiveDateTo = format(subDays(new Date(r.date_to), 1), 'yyyy-MM-dd');

      values.push({
        property_id: propMapping.channex_id,
        rate_plan_id: channexRpId,
        date_from: r.date_from,
        date_to: inclusiveDateTo,
        min_stay_arrival: r.min_stay_arrival || 1,
        min_stay_through: r.min_stay_through || 1,
        ...(r.max_stay ? { max_stay: r.max_stay } : {}),
        stop_sell: r.stop_sell || false,
        closed_to_arrival: r.closed_to_arrival || false,
        closed_to_departure: r.closed_to_departure || false,
      });
    }

    // Push in batches
    for (let i = 0; i < values.length; i += BATCH_SIZE) {
      const batch = values.slice(i, i + BATCH_SIZE);
      try {
        const result: any = await channexRequest("POST", "/api/v1/restrictions", { values: batch });
        allResponses.push(result);
        summary.restrictions_pushed += batch.length;

        // Mark synced
        const batchRestrictions = restrictions.slice(i, i + BATCH_SIZE);
        const ids = batchRestrictions.map((r: any) => r.id);
        await supabase
          .from("rate_plan_restrictions")
          .update({
            synced_to_channex: true,
            channex_task_id: result?.data?.[0]?.id || result?.data?.id || null,
          })
          .in("id", ids);
      } catch (err: any) {
        summary.errors.push(`Batch ${Math.floor(i / BATCH_SIZE)}: ${err.message}`);
      }
      if (i + BATCH_SIZE < values.length) await delay(BATCH_DELAY_MS);
    }

    await logSync(
      "channex-push-restrictions",
      "/api/v1/restrictions",
      { values },
      { summary, channex_responses: allResponses },
      200,
      summary.errors.length === 0,
      summary.errors.length > 0 ? summary.errors.join("; ") : null,
      propMapping.local_id
    );

    return respond(200, { success: true, summary });
  } catch (err: any) {
    console.error("[push-restrictions] Error:", err);
    return respond(500, { success: false, error: err.message, summary });
  }
});

function respond(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
