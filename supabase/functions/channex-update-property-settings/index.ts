import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { channexRequest, logSync } from "../_shared/channex-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  console.log(`[diag] Request received: ${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  let parsedBody: any = null;
  let resolvedChannexId: string | null = null;

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
    console.log(`[diag] Authenticated user: ${user.id}`);

    // Admin check
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    console.log(`[diag] Admin check passed`);

    // --- Parse body ---
    parsedBody = await req.json();
    const { property_id, min_price, max_price } = parsedBody;
    console.log(`[diag] Parsed body:`, JSON.stringify({ property_id, min_price, max_price }));

    if (!property_id) {
      return new Response(JSON.stringify({ error: "property_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (min_price === null && max_price === null) {
      return new Response(JSON.stringify({ error: "At least one of min_price or max_price must be set" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // --- Resolve Channex property ID ---
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: mapping } = await serviceSupabase
      .from("channex_mappings")
      .select("channex_id")
      .eq("local_id", property_id)
      .eq("entity_type", "property")
      .eq("sync_status", "synced")
      .maybeSingle();

    if (!mapping) {
      return new Response(JSON.stringify({ error: "Property not synced to Channex" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const channexPropertyId = mapping.channex_id;

    // --- Build Channex payload ---
    const settings: Record<string, unknown> = {};
    if (min_price !== null && min_price !== undefined) {
      settings.min_price = Math.round(min_price * 100);
    }
    if (max_price !== null && max_price !== undefined) {
      settings.max_price = Math.round(max_price * 100);
    }

    const channexPayload = {
      property: {
        settings,
      },
    };

    console.log(`[channex-update-property-settings] Updating property ${channexPropertyId} with settings:`, JSON.stringify(settings));

    // --- Call Channex API ---
    const response = await channexRequest<object>(
      "PUT",
      `/api/v1/properties/${channexPropertyId}`,
      channexPayload
    );

    // --- Log sync ---
    await logSync(
      "channex-update-property-settings",
      `/api/v1/properties/${channexPropertyId}`,
      channexPayload,
      response,
      200,
      true,
      null,
      property_id
    );

    return new Response(
      JSON.stringify({ success: true, message: "Property settings updated in Channex" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err: any) {
    console.error("[channex-update-property-settings] Error:", err);

    try {
      const body = await req.clone().json().catch(() => ({}));
      await logSync(
        "channex-update-property-settings",
        "/api/v1/properties/*",
        body,
        null,
        null,
        false,
        err.message,
        body?.property_id || null
      );
    } catch (_logErr) {
      /* ignore logging errors */
    }

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
