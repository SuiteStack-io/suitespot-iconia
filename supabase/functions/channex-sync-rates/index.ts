
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { channexRequest, logSync } from "../_shared/channex-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const userId = claimsData.claims.sub;

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { updates, propertyId } = await req.json();

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return new Response(JSON.stringify({ error: "No updates provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve Channex IDs
    const mappingCache: Record<string, string> = {};
    async function resolveChannexId(localId: string, entityType: string): Promise<string | null> {
      const key = `${entityType}:${localId}`;
      if (mappingCache[key]) return mappingCache[key];
      const { data } = await serviceSupabase
        .from("channex_mappings")
        .select("channex_id")
        .eq("local_id", localId)
        .eq("entity_type", entityType)
        .eq("sync_status", "synced")
        .maybeSingle();
      if (data) mappingCache[key] = data.channex_id;
      return data?.channex_id || null;
    }

    const values: object[] = [];
    const errors: object[] = [];

    for (let i = 0; i < updates.length; i++) {
      const u = updates[i];
      const channexPropertyId = await resolveChannexId(u.property_id, "property");
      if (!channexPropertyId) {
        errors.push({ index: i, error: "Property not synced to Channex", property_id: u.property_id });
        continue;
      }
      const channexRatePlanId = await resolveChannexId(u.rate_plan_id, "rate_plan");
      if (!channexRatePlanId) {
        errors.push({ index: i, error: "Rate plan not synced to Channex", rate_plan_id: u.rate_plan_id });
        continue;
      }

      const value: Record<string, unknown> = {
        property_id: channexPropertyId,
        rate_plan_id: channexRatePlanId,
        date_from: u.date_from,
        date_to: u.date_to,
        rate: Math.round(u.rate * 100),
      };

      if (u.min_stay_arrival !== undefined) value.min_stay_arrival = u.min_stay_arrival;
      if (u.min_stay_through !== undefined) value.min_stay_through = u.min_stay_through;
      if (u.closed_to_arrival !== undefined) value.closed_to_arrival = u.closed_to_arrival;
      if (u.closed_to_departure !== undefined) value.closed_to_departure = u.closed_to_departure;
      if (u.stop_sell !== undefined) value.stop_sell = u.stop_sell;

      values.push(value);
    }

    if (values.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "All updates failed mapping resolution", errors }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Push to Channex in one call
    const channexPayload = { values };
    console.log(`[channex-sync-rates] Pushing ${values.length} values to Channex`);

    const response = await channexRequest<object>("POST", "/api/v1/restrictions", channexPayload);

    await logSync(
      "channex-sync-rates",
      "/api/v1/restrictions",
      channexPayload,
      response,
      200,
      true,
      null,
      propertyId || null
    );

    return new Response(JSON.stringify({
      success: true,
      message: errors.length > 0 ? "Rates pushed with some errors" : "Rates synced successfully",
      values_count: values.length,
      ...(errors.length > 0 ? { errors } : {}),
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    console.error("[channex-sync-rates] Error:", err);

    try {
      await logSync("channex-sync-rates", "/api/v1/restrictions", null, null, null, false, err.message, null);
    } catch { /* ignore */ }

    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: err.message?.includes("Channex API request failed") ? 502 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
