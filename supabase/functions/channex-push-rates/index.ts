import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { channexRequest, logSync } from "../_shared/channex-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface RateUpdate {
  property_id: string;
  rate_plan_id: string;
  date_from: string;
  date_to: string;
  rate: number;
  min_stay_arrival?: number;
  min_stay_through?: number;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
  stop_sell?: boolean;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    // --- Auth ---
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const userId = user.id;

    // Admin check
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

    // --- Parse & normalize ---
    const body = await req.json();
    const updates: RateUpdate[] = body.updates
      ? body.updates
      : [
          {
            property_id: body.property_id,
            rate_plan_id: body.rate_plan_id,
            date_from: body.date_from,
            date_to: body.date_to,
            rate: body.rate,
            min_stay_arrival: body.min_stay_arrival,
            min_stay_through: body.min_stay_through,
            closed_to_arrival: body.closed_to_arrival,
            closed_to_departure: body.closed_to_departure,
            stop_sell: body.stop_sell,
          },
        ];

    // --- Validate ---
    for (let i = 0; i < updates.length; i++) {
      const u = updates[i];
      if (!u.property_id || !u.rate_plan_id) {
        return new Response(
          JSON.stringify({ error: `Update ${i}: property_id and rate_plan_id are required` }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      if (!u.date_from || !DATE_RE.test(u.date_from) || !u.date_to || !DATE_RE.test(u.date_to)) {
        return new Response(
          JSON.stringify({ error: `Update ${i}: date_from and date_to must be YYYY-MM-DD` }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      if (typeof u.rate !== "number" || u.rate <= 0) {
        return new Response(
          JSON.stringify({ error: `Update ${i}: rate must be a positive number` }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // --- Resolve Channex IDs ---
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const mappingCache: Record<string, string> = {};

    async function resolveChannexId(localId: string, entityType: string): Promise<string | null> {
      const key = `${entityType}:${localId}`;
      if (mappingCache[key]) return mappingCache[key];
      const { data } = await serviceSupabase
        .from("channex_mappings")
        .select("channex_id")
        .eq("local_id", localId)
        .eq("entity_type", entityType)
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

    // --- Push to Channex ---
    const channexPayload = { values };
    console.log(`[channex-push-rates] Pushing ${values.length} values to Channex`);
    console.log(`[channex-push-rates] Full payload:`, JSON.stringify(channexPayload, null, 2));

    const response = await channexRequest<object>("POST", "/api/v1/restrictions", channexPayload);

    // Log success
    await logSync(
      "channex-push-rates",
      "/api/v1/restrictions",
      channexPayload,
      response,
      200,
      true,
      null,
      updates[0]?.property_id || null
    );

    const result: Record<string, unknown> = {
      success: true,
      message: errors.length > 0 ? "Rates pushed with some errors" : "Rates pushed successfully",
      values_count: values.length,
    };
    if (errors.length > 0) result.errors = errors;

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    console.error("[channex-push-rates] Error:", err);

    try {
      await logSync("channex-push-rates", "/api/v1/restrictions", null, null, null, false, err.message, null);
    } catch { /* ignore logging errors */ }

    const isChannexError = err.message?.includes("Channex API request failed");
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: isChannexError ? 502 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
