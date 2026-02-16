import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { channexRequest } from "../_shared/channex-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin role
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
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleData } = await adminSupabase
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

    const { property_id } = await req.json();
    if (!property_id) {
      return new Response(JSON.stringify({ error: "property_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Resolve local ID to Channex property ID
    const { data: mapping } = await adminSupabase
      .from("channex_mappings")
      .select("channex_id")
      .eq("local_id", property_id)
      .eq("entity_type", "property")
      .eq("sync_status", "synced")
      .maybeSingle();

    if (!mapping) {
      return new Response(
        JSON.stringify({ error: "No Channex mapping found for this property" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const channexId = mapping.channex_id;
    const today = new Date().toISOString().split("T")[0];

    // Fetch all four endpoints in parallel
    const [property, roomTypes, ratePlans, availability] = await Promise.allSettled([
      channexRequest("GET", `/api/v1/properties/${channexId}`),
      channexRequest("GET", `/api/v1/room_types?filter[property_id]=${channexId}`),
      channexRequest("GET", `/api/v1/rate_plans?filter[property_id]=${channexId}`),
      channexRequest("GET", `/api/v1/availability?filter[property_id]=${channexId}&filter[date][gte]=${today}`),
    ]);

    const result = {
      property: property.status === "fulfilled" ? property.value : { error: (property as PromiseRejectedResult).reason?.message },
      room_types: roomTypes.status === "fulfilled" ? roomTypes.value : { error: (roomTypes as PromiseRejectedResult).reason?.message },
      rate_plans: ratePlans.status === "fulfilled" ? ratePlans.value : { error: (ratePlans as PromiseRejectedResult).reason?.message },
      availability: availability.status === "fulfilled" ? availability.value : { error: (availability as PromiseRejectedResult).reason?.message },
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
